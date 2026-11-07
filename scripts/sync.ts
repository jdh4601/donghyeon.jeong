import { enqueueSync, processQueue } from "../src/lib/sync";
await enqueueSync();
console.log(await processQueue());
