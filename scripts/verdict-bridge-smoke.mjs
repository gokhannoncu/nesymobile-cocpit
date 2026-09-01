/**
 * ===========================================================================
 *  CP3 GERÇEK DUT SMOKE  (Plan D.3 · RUN_PLAY 3.12)
 *
 *  Fake bridge testleri protokolün HOST tarafını kanıtlar. Cihazın gerçekten
 *  aynı sözleşmeyi konuştuğunu kanıtlamazlar — ve bu ikisi arasındaki fark tam
 *  olarak "testler yeşil, cihazda hiçbir şey çalışmıyor" durumudur.
 *
 *  Bu script fiziksel cihaza karşı koşar ve her adımın SONUCUNU yazar. Hiçbir
 *  adımı "başarılı sayma" yok: cihaz ne dediyse o raporlanır.
 *
 *  Kullanım:
 *    node scripts/verdict-bridge-smoke.mjs <deviceId>
 *    node scripts/verdict-bridge-smoke.mjs <deviceId> --read-only
 *
 *  `--read-only`: production build'de DURMAK yerine YALNIZ gözlem adımlarını
 *  koşar. Hiçbir mutation göndermez — `tap_*`, `input_text`, `swipe`, `back`,
 *  `activate_id`, `scroll_to_item` hiç denenmez. Amacı protocol PARİTESİNİ
 *  kanıtlamak: host sözleşmesinin cihazın gerçekten konuştuğu şey olduğunu
 *  göstermek. Bu, Act Mode DEĞİLDİR ve production deny kuralını gevşetmez —
 *  o kural jest enjeksiyonu hakkındadır ve `--read-only` kipinde enjeksiyon
 *  yoluna hiç girilmez.
 *
 *  ⚠️ `screenshot` ve `dump` cihazın ekran içeriğini okur. Başkasının
 *  cihazında bunları koşmak bir gizlilik kararıdır; script bu yüzden
 *  `--allow-screen-capture` olmadan ekran görüntüsü ALMAZ.
 *
 *  Ortam:
 *    ADB_PATH          adb ikilisi (PATH'te değilse)
 *    BRIDGE_HOST_PORT  host tarafı forward portu (varsayılan 21876)
 * ===========================================================================
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Socket } from "node:net";

const execFileAsync = promisify(execFile);
const ADB = process.env.ADB_PATH ?? "adb";
const DEVICE_PORT = 9876;
const HOST_PORT = Number(process.env.BRIDGE_HOST_PORT ?? "21876");
const PROTOCOL_VERSION = 1;

const deviceId = process.argv[2];
const READ_ONLY = process.argv.includes("--read-only");
const ALLOW_SCREEN_CAPTURE = process.argv.includes("--allow-screen-capture");
if (!deviceId) {
  console.error("usage: node scripts/verdict-bridge-smoke.mjs <deviceId>");
  process.exit(2);
}

const scope = {
  runId: `smoke-${Date.now().toString(36)}`,
  sessionId: "smoke-session",
  runEpoch: Date.now(),
};

const results = [];
function record(step, status, detail) {
  results.push({ step, status, detail });
  const icon = status === "PASS" ? "✓" : status === "SKIP" ? "–" : "✗";
  console.log(`${icon} ${step}: ${status}${detail ? ` — ${detail}` : ""}`);
}

async function adb(args, timeout = 15_000) {
  const { stdout } = await execFileAsync(ADB, ["-s", deviceId, ...args], { timeout, maxBuffer: 8 * 1024 * 1024 });
  return String(stdout);
}

/**
 * Tek istek = tek bağlantı.
 *
 * Cihaz bir bağlantıda istekleri SIRAYLA işler (`BridgeTcpServer.serve`), bu
 * yüzden smoke'un paralel adımları ayrı soket kullanmak zorunda. Aynı soketi
 * yeniden kullanmak "yarış" adımını sessizce ardışık beklemeye çevirirdi.
 */
function request(command, params = {}, timeoutMs = 20_000, requestId = `sm-${command}-${Date.now().toString(36)}`) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let buffer = "";
    let handshaked = false;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const send = (payload) => socket.write(`${JSON.stringify(payload)}\n`);

    socket.connect(HOST_PORT, "127.0.0.1", () => {
      // Handshake SOKET BAŞINA zorunlu: `ProtocolV1.Session` bağlantıya özel.
      send({ ...scope, requestId: `${requestId}-hs`, protocolVersion: PROTOCOL_VERSION, command: "handshake" });
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line === "") continue;
        let envelope;
        try {
          envelope = JSON.parse(line);
        } catch {
          clearTimeout(timer);
          socket.destroy();
          reject(new Error(`${command}: device sent non-JSON: ${line.slice(0, 120)}`));
          return;
        }
        if (!handshaked) {
          handshaked = true;
          if (envelope.ok !== true) {
            clearTimeout(timer);
            socket.destroy();
            reject(new Error(`handshake rejected: ${envelope.error}`));
            return;
          }
          send({ ...scope, requestId, protocolVersion: PROTOCOL_VERSION, command, ...params });
          continue;
        }
        clearTimeout(timer);
        socket.destroy();
        resolve(envelope);
        return;
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  // ---- Preflight -----------------------------------------------------------
  const buildType = (await adb(["shell", "getprop", "ro.build.type"])).trim();
  if (buildType === "user") {
    // Production deny fail-closed. Jest enjeksiyonu her koşulda reddedilir;
    // `--read-only` yalnız GÖZLEM adımlarına izin verir ve enjeksiyon yoluna
    // hiç girmez.
    record("production-deny", "PASS", `ro.build.type=${buildType} → gesture injection refused`);
    if (!READ_ONLY) {
      console.log("\nSMOKE HALTED: production device. This is the correct outcome, not a failure.");
      console.log("Re-run with --read-only to verify protocol parity without any mutation.");
      process.exit(0);
    }
    console.log("  (read-only mode: no tap/input/swipe/back/activate/scroll will be sent)\n");
  } else {
    record("lab-build", "PASS", `ro.build.type=${buildType}`);
  }

  const packages = await adb(["shell", "pm", "list", "packages", "com.verdict.bridge"]);
  if (!packages.includes("package:com.verdict.bridge")) {
    record("bridge-apk", "FAIL", "com.verdict.bridge is not installed");
    process.exit(1);
  }
  record("bridge-apk", "PASS", "com.verdict.bridge installed");

  const services = await adb(["shell", "settings", "get", "secure", "enabled_accessibility_services"]);
  if (!services.includes("com.verdict.bridge")) {
    record("accessibility", "FAIL", "BridgeAccessibilityService is not enabled — the TCP listener starts with it");
    process.exit(1);
  }
  record("accessibility", "PASS", "BridgeAccessibilityService enabled");

  // `--no-rebind` şart: onsuz ikinci forward sessizce ilkini çalar.
  await adb(["forward", "--remove", `tcp:${HOST_PORT}`]).catch(() => undefined);
  await adb(["forward", "--no-rebind", `tcp:${HOST_PORT}`, `tcp:${DEVICE_PORT}`]);
  record("port-forward", "PASS", `tcp:${HOST_PORT} → tcp:${DEVICE_PORT}`);

  try {
    // ---- Protocol ----------------------------------------------------------
    const ping = await request("ping", {}, 8_000);
    if (ping.ok !== true || ping.protocolVersion !== PROTOCOL_VERSION) {
      record("ping", "FAIL", JSON.stringify(ping).slice(0, 200));
      process.exit(1);
    }
    record("ping", "PASS", `protocolVersion=${ping.protocolVersion}, monoTs=${ping.monoTs}`);

    // `wait_any` / `cancel_request` Mobile M3'ten beri UYGULANIYOR — bu iki adım
    // hâlâ "yok mu?" diye soruyordu ve her sağlıklı köprüde FAIL basıyordu. Yalan
    // söyleyen bir sağlık kontrolü, kontrolsüzlükten kötüdür: 2026-09-01'de köprü
    // gerçekten çökmüşken de, sapasağlamken de aynı "18/20" görünüyordu.
    //
    // Doğru soru artık şu: komut TANINIYOR mu? Eksik argümanla çağrılıyor, çünkü
    // dolu bir çağrı gerçek bir bekleme başlatır. `unsupported_command` = komut
    // yok (regresyon); `missing_*`/`invalid_*` = komut var ve argümanı denetliyor.
    const waitAny = await request("wait_any", { value: "x" }, 8_000);
    record(
      "wait_any-supported",
      waitAny.error !== "unsupported_command" ? "PASS" : "FAIL",
      `device says: ${waitAny.error ?? JSON.stringify(waitAny).slice(0, 120)}`,
    );
    const cancel = await request("cancel_request", { targetRequestId: "x" }, 8_000);
    record(
      "cancel_request-supported",
      cancel.error !== "unsupported_command" ? "PASS" : "FAIL",
      `device says: ${cancel.error ?? JSON.stringify(cancel).slice(0, 120)}`,
    );
    const watch = await request("register_watch", {}, 8_000);
    record(
      "register_watch-absent",
      watch.error === "unsupported_command" ? "PASS" : "FAIL",
      `device says: ${watch.error ?? JSON.stringify(watch).slice(0, 120)}`,
    );

    // Protocol mismatch fail-fast.
    const badVersion = await new Promise((resolve, reject) => {
      const socket = new Socket();
      let buf = "";
      socket.connect(HOST_PORT, "127.0.0.1", () => {
        socket.write(`${JSON.stringify({ ...scope, requestId: "sm-badver", protocolVersion: 99, command: "ping" })}\n`);
      });
      socket.on("data", (c) => {
        buf += c.toString("utf8");
        const i = buf.indexOf("\n");
        if (i === -1) return;
        socket.destroy();
        resolve(JSON.parse(buf.slice(0, i)));
      });
      socket.on("error", reject);
      setTimeout(() => {
        socket.destroy();
        reject(new Error("protocol-mismatch timed out"));
      }, 8_000);
    });
    record(
      "protocol-mismatch",
      badVersion.error === "unsupported_protocol_version" ? "PASS" : "FAIL",
      `device says: ${badVersion.error}`,
    );

    // ---- Observation -------------------------------------------------------
    // `maxDepth: 1` bilinçli: sözleşme paritesini kanıtlamak için kök seviyesi
    // yeterli, ve ekran içeriğinin tamamını okumaya gerek yok. Yalnız SAYILAR
    // raporlanır — node metinleri asla loglanmaz.
    const dump = await request("dump", { scope: "depth", maxDepth: 1 }, 20_000);
    record(
      "scoped-dump",
      dump.ok === true ? "PASS" : "FAIL",
      dump.ok === true
        ? `treeGen=${dump.treeGen}, nodes=${Array.isArray(dump.nodes) ? dump.nodes.length : "n/a"} (contents NOT logged)`
        : `error=${dump.error}`,
    );

    // Var olmayan bir hedef: `not_found` beklenir ve HİÇBİR aksiyon uygulanmaz.
    const missing = await request("find_id", { value: "nesy_smoke_definitely_absent" }, 15_000);
    record(
      "find-not-found",
      missing.ok === false && missing.error === "not_found" ? "PASS" : "FAIL",
      `error=${missing.error}, matched=${missing.matched}`,
    );

    // Ambiguity: çok geniş bir metin eşlemesi genellikle >1 node bulur.
    const ambiguous = await request("find_text", { value: "", exact: false }, 15_000);
    record(
      "ambiguity-or-refusal",
      ambiguous.ok === false ? "PASS" : "FAIL",
      `error=${ambiguous.error}, matched=${ambiguous.matched} (no action was attempted)`,
    );

    // Stale tree: kasıtlı olarak yanlış bir `expectTreeGen` gönder. Cihaz
    // aksiyonu UYGULAMADAN reddetmeli.
    //
    // `--read-only` kipinde ATLANIR: hedef var olmadığı için hiçbir şeye
    // dokunulmayacağı KESİN olsa da, `tap_id` bir mutation komutudur ve
    // "kesin güvenli olduğu için gönderdim" muhakemesi tam olarak production
    // cihaza jest gönderme yolunun başlangıcıdır.
    if (READ_ONLY) {
      record("stale-or-missing-refused", "SKIP", "read-only mode: tap_id is a mutation command");
    } else {
      const stale = await request(
        "tap_id",
        { value: "nesy_smoke_definitely_absent", expectTreeGen: 1 },
        15_000,
      );
      record(
        "stale-or-missing-refused",
        stale.ok === false ? "PASS" : "FAIL",
        `error=${stale.error} (nothing was tapped)`,
      );
    }

    // ---- Wait --------------------------------------------------------------
    const waitStart = Date.now();
    const waitTimeout = await request(
      "wait_node",
      { by: "id", value: "nesy_smoke_definitely_absent", until: "appear", timeoutMs: 1500 },
      20_000,
    );
    const waited = Date.now() - waitStart;
    record(
      "wait_node-timeout",
      waitTimeout.ok === false && waitTimeout.error === "timeout" ? "PASS" : "FAIL",
      `error=${waitTimeout.error}, polls=${waitTimeout.polls}, waited≈${waited}ms`,
    );

    // Uzun bekleme CONTROL'ü bloke etmiyor — AYRI soketten ping.
    const longWait = request(
      "wait_node",
      { by: "id", value: "nesy_smoke_definitely_absent", until: "appear", timeoutMs: 6000 },
      20_000,
    );
    await new Promise((r) => setTimeout(r, 300));
    const controlStart = Date.now();
    const controlPing = await request("ping", {}, 8_000);
    const controlLatency = Date.now() - controlStart;
    // Eşik MUTLAK bir ms değeri değil, beklemenin süresine GÖRE.
    //
    // Asıl iddia şu: CONTROL isteği 6 saniyelik beklemenin ARKASINDA KUYRUĞA
    // GİRMEDİ. Sabit 2000ms eşiği bunu gerçek cihazda yanlış raporluyordu —
    // yük altında 3.1s'de yanıtlanan bir ping hâlâ kuyruğa girmemiştir, ama
    // sabit eşik onu "FAIL" sayıyordu. Kuyruğa girmiş olsa ≥6000ms olurdu.
    const WAIT_MS = 6_000;
    record(
      "control-not-blocked-by-wait",
      controlPing.ok === true && controlLatency < WAIT_MS * 0.7 ? "PASS" : "FAIL",
      `control ping answered in ${controlLatency}ms while a ${WAIT_MS}ms wait was in flight ` +
        `on another socket (queued behind it would be ≥${WAIT_MS}ms)`,
    );
    await longWait;

    // ---- Screenshot --------------------------------------------------------
    // Ekran görüntüsü cihazın o anki içeriğini okur. Başkasının cihazında bunu
    // koşmak bir gizlilik kararıdır ve açık onay gerektirir.
    if (!ALLOW_SCREEN_CAPTURE) {
      record("screenshot", "SKIP", "needs --allow-screen-capture (reads the device screen content)");
    } else {
      const shot = await request("screenshot", {}, 30_000);
      if (shot.ok === true && typeof shot.data === "string") {
        const bytes = Buffer.from(shot.data, "base64");
        record("screenshot", "PASS", `${shot.width}x${shot.height}, ${bytes.byteLength} bytes (data NOT logged)`);
      } else {
        record("screenshot", "FAIL", `error=${shot.error}`);
      }
    }

    // ---- Idempotency -------------------------------------------------------
    const id = `sm-idem-${Date.now().toString(36)}`;
    const first = await request("find_id", { value: "nesy_smoke_definitely_absent" }, 15_000, id);
    const replay = await request("find_id", { value: "nesy_smoke_definitely_absent" }, 15_000, id);
    record(
      "requestId-idempotent",
      first.monoTs === replay.monoTs ? "PASS" : "FAIL",
      `same id + same payload returned the cached response (monoTs ${first.monoTs} === ${replay.monoTs})`,
    );

    const conflict = await request("find_id", { value: "a_different_value" }, 15_000, id);
    record(
      "requestId-conflict",
      conflict.error === "request_id_conflict" ? "PASS" : "FAIL",
      `same id + different payload → ${conflict.error}`,
    );

    // ---- Fencing -----------------------------------------------------------
    const staleRun = await new Promise((resolve, reject) => {
      const socket = new Socket();
      let buf = "";
      let hs = false;
      socket.connect(HOST_PORT, "127.0.0.1", () => {
        socket.write(`${JSON.stringify({ ...scope, requestId: "sm-fence-hs", protocolVersion: 1, command: "handshake" })}\n`);
      });
      socket.on("data", (c) => {
        buf += c.toString("utf8");
        let i;
        while ((i = buf.indexOf("\n")) !== -1) {
          const env = JSON.parse(buf.slice(0, i));
          buf = buf.slice(i + 1);
          if (!hs) {
            hs = true;
            // Aynı sokette FARKLI bir epoch: fencing devreye girmeli.
            socket.write(
              `${JSON.stringify({ ...scope, runEpoch: scope.runEpoch + 5, requestId: "sm-fence", protocolVersion: 1, command: "ping" })}\n`,
            );
            continue;
          }
          socket.destroy();
          resolve(env);
          return;
        }
      });
      socket.on("error", reject);
      setTimeout(() => {
        socket.destroy();
        reject(new Error("fencing check timed out"));
      }, 8_000);
    });
    record(
      "run-fencing",
      staleRun.error === "stale_run" || staleRun.error === "wrong_session" ? "PASS" : "FAIL",
      `mismatched runEpoch → ${staleRun.error} (expectedRunEpoch=${staleRun.expectedRunEpoch})`,
    );
  } finally {
    await adb(["forward", "--remove", `tcp:${HOST_PORT}`]).catch(() => undefined);
    record("forward-cleanup", "PASS", `removed tcp:${HOST_PORT}`);
  }

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  if (failed.length > 0) {
    console.log("FAILED STEPS:");
    for (const f of failed) console.log(`  - ${f.step}: ${f.detail}`);
    process.exit(1);
  }
  console.log("CP3 smoke: ALL PASS");
}

main().catch((err) => {
  console.error(`\nsmoke aborted: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
