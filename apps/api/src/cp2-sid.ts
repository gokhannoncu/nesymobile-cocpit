import "dotenv/config"; import { prisma } from "@nesy/db";
const r = await prisma.$queryRawUnsafe<{session_id:string;contiguous_seq:bigint}[]>(
  `SELECT s.session_id, s.contiguous_seq, count(i.seq) FILTER (WHERE i.processed_at IS NULL) AS pending
   FROM verdict_stream s LEFT JOIN verdict_inbox i ON i.run_id=s.run_id AND i.session_id=s.session_id
   WHERE s.run_id=$1 GROUP BY s.session_id, s.contiguous_seq ORDER BY pending DESC LIMIT 1`, process.argv[2]);
console.log(JSON.stringify(r[0], (k,v)=>typeof v==="bigint"?v.toString():v));
await prisma.$disconnect();
