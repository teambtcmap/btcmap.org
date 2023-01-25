export function GET() {
  return new Response(
    JSON.stringify({
      names: {
        _: "3eab247c63bb35dfa38e07ca102f6da28ba9b9d4687197743bde3a2b1d80aeed",
      },
    }),
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
