export function GET() {
	return new Response(
		JSON.stringify({
			names: {
				_: '3eab247c63bb35dfa38e07ca102f6da28ba9b9d4687197743bde3a2b1d80aeed',
				nathan: 'c4f5e7a75a8ce3683d529cff06368439c529e5243c6b125ba68789198856cac7',
				rockedf: '7e9a12f456e1666dd0c358ed3ce579e020286ee9b64d2c9bdb9a907e47017de6'
			}
		}),
		{ headers: { 'Access-Control-Allow-Origin': '*' } }
	);
}
