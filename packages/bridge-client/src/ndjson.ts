/**
 * ===========================================================================
 *  ARTIMLI NDJSON PARSER  (Plan D.3)
 *
 *  TCP bir MESAJ protokolü değil, bir BAYT AKIŞIdır. `socket.on("data")`'nın
 *  bir çağrıda tam bir satır vereceğine dair hiçbir garanti yoktur:
 *
 *    - bir yanıt üç `data` olayına bölünebilir,
 *    - üç yanıt tek `data` olayında gelebilir,
 *    - bir çok baytlı UTF-8 karakter iki chunk'ın ORTASINDAN bölünebilir.
 *
 *  Bunları elle `buffer.toString().split("\n")` ile ele almak, üçüncü maddede
 *  sessizce bozuk karakter üretir — ve bu, base64 PNG taşıyan bir `screenshot`
 *  yanıtında ekran görüntüsünü çözülemez hale getirir. `StringDecoder` bu
 *  yüzden var: yarım karakteri tutar, tamamlanınca verir.
 *
 *  Parser NEDEN JSON çözmüyor: çerçeveleme ile şema doğrulaması iki ayrı
 *  sorumluluk. Bozuk JSON'un bir satırı ATLAMASI gerekir, akışı bozmaması
 *  gerekir; bunun için önce çerçeveyi ayırmak, sonra `decodeResult` ile
 *  doğrulamak gerekiyor.
 * ===========================================================================
 */
import { StringDecoder } from "node:string_decoder";

export interface NdjsonParserOptions {
  /** Tek satır için üst sınır. Aşıldığında `onOversized` çağrılır ve satır atılır. */
  maxFrameBytes: number;
  onLine: (line: string) => void;
  /**
   * Sınır aşıldı.
   *
   * Bu geri çağrım olmadan tek çare bağlantıyı kapatmak olurdu; oysa çoğu
   * durumda tek bir dev satırı atıp devam etmek doğru davranıştır — ve
   * atıldığının GÖRÜNÜR olması şart, sessiz atma teşhisi imkânsızlaştırır.
   */
  onOversized: (droppedBytes: number) => void;
}

export class NdjsonParser {
  private readonly decoder = new StringDecoder("utf8");
  private pending = "";
  /**
   * `pending` sınırı aştığında, satır sonu gelene kadar her şeyi atma kipi.
   *
   * Sınırı aşan satırı atarken KALAN kısmını da atmak gerekiyor; yoksa dev
   * satırın ortasından itibaren biriken baytlar "yeni bir satır" gibi
   * ayrıştırılır ve tamamen uydurma bir frame üretir.
   */
  private discardingUntilNewline = false;

  constructor(private readonly options: NdjsonParserOptions) {}

  push(chunk: Buffer): void {
    // Yarım UTF-8 karakteri tutar; tamamlanınca verir. Bu satır olmadan
    // chunk sınırına denk gelen her Türkçe karakter bozulur.
    this.pending += this.decoder.write(chunk);

    for (;;) {
      const newlineAt = this.pending.indexOf("\n");

      if (newlineAt === -1) {
        if (this.discardingUntilNewline) {
          this.pending = "";
          return;
        }
        if (Buffer.byteLength(this.pending, "utf8") > this.options.maxFrameBytes) {
          // Satır sonu hiç gelmeyebilir (bozuk ya da kötü niyetli akış).
          // Sınırsız biriktirmek belleği tüketir.
          this.options.onOversized(Buffer.byteLength(this.pending, "utf8"));
          this.pending = "";
          this.discardingUntilNewline = true;
        }
        return;
      }

      const raw = this.pending.slice(0, newlineAt);
      this.pending = this.pending.slice(newlineAt + 1);

      if (this.discardingUntilNewline) {
        // Atılan dev satırın kuyruğu bitti; normale dön.
        this.discardingUntilNewline = false;
        continue;
      }

      // `\r\n` toleransı: cihaz `writer.newLine()` kullanıyor, platforma göre
      // CRLF üretebilir ve `\r` JSON'u bozar.
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (line.trim() === "") continue; // boş satır çerçeve değildir

      if (Buffer.byteLength(line, "utf8") > this.options.maxFrameBytes) {
        this.options.onOversized(Buffer.byteLength(line, "utf8"));
        continue;
      }
      this.options.onLine(line);
    }
  }

  /** Akış kapandı. Yarım kalan veri bir çerçeve DEĞİLDİR ve teslim edilmez. */
  end(): void {
    // Kasıtlı: satır sonu görülmemiş bir kuyruk tamamlanmamış bir yanıttır.
    // Onu teslim etmek, yarısı gelmiş bir JSON'u geçerli sanmak olurdu.
    this.pending = "";
    this.discardingUntilNewline = false;
    this.decoder.end();
  }

  /** Tamponda bekleyen bayt sayısı — leak iddialarını test edilebilir kılar. */
  pendingBytes(): number {
    return Buffer.byteLength(this.pending, "utf8");
  }
}
