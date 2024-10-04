export function GET() {
	return new Response(
		JSON.stringify({
			names: {
				_: '3eab247c63bb35dfa38e07ca102f6da28ba9b9d4687197743bde3a2b1d80aeed',
				nathan: 'c4f5e7a75a8ce3683d529cff06368439c529e5243c6b125ba68789198856cac7',
				rockedf: '205394b7b30c160b6c98a864b652778922863a352155d215fc4599c3f118ebb3'
			}
		}),
		{ headers: { 'Access-Control-Allow-Origin': '*' } }
	);
}
