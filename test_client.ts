
import { fetch } from "bun";

async function test() {
  console.log("Testing Plain...");
  try {
      const res1 = await fetch("http://localhost:4221/echo/hello");
      console.log("Plain Status:", res1.status);
      console.log("Plain Body:", await res1.text());
  } catch (e) {
      console.log("Plain Error:", e);
  }

  console.log("\nTesting Gzip...");
  try {
      const res2 = await fetch("http://localhost:4221/echo/hello", {
        headers: { "Accept-Encoding": "gzip" }
      });
      console.log("Gzip Status:", res2.status);
      console.log("Gzip Headers:", [...res2.headers.entries()]);
      
      const arrayBuffer = await res2.arrayBuffer();
      const hex = Buffer.from(arrayBuffer).toString('hex');
      console.log("Gzip Body (Hex):", hex);
      
      // Try to decode if gzip
      console.log("Gzip Body (Text):", await new Response(arrayBuffer).text());

  } catch (e) {
      console.log("Gzip Error:", e);
  }
}

test();
