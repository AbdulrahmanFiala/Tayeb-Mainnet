import { useNavigate } from "react-router";

export function AboutPage() {
	const navigate = useNavigate();

	return (
		<div className='flex-1 flex flex-col py-16 px-4 sm:px-8 lg:px-10'>
			<div className='max-w-4xl mx-auto w-full'>
				{/* Hero Section */}
				<div className='text-center mb-16'>
					<div className='inline-block size-16 text-primary mb-6'>
						<svg
							fill='currentColor'
							viewBox='0 0 48 48'
							xmlns='http://www.w3.org/2000/svg'
						>
							<path
								clipRule='evenodd'
								d='M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z'
								fillRule='evenodd'
							/>
							<path
								clipRule='evenodd'
								d='M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z'
								fillRule='evenodd'
							/>
						</svg>
					</div>
					<h1 className='text-5xl font-bold text-white mb-4'>About Tayeb</h1>
					<p className='text-xl text-[#92c9b7] max-w-2xl mx-auto'>
						The First Fully Sharia-Compliant DEX for Halal Crypto Trading
					</p>
				</div>

				{/* Main Content */}
				<div className='space-y-12'>
					{/* What is Tayeb */}
					<section className='bg-[#1a2e26] rounded-xl p-8 border border-[#23483c]'>
						<h2 className='text-3xl font-bold text-white mb-4'>What is Tayeb?</h2>
						<p className='text-lg text-gray-300 leading-relaxed mb-4'>
							Tayeb is a revolutionary decentralized exchange (DEX) built on Moonbeam
							that provides a fully Sharia-compliant platform for cryptocurrency trading.
							We enable Muslims and ethical investors to participate in the DeFi ecosystem
							while adhering to Islamic financial principles.
						</p>
						<p className='text-lg text-gray-300 leading-relaxed'>
							Our platform ensures that all trading activities comply with Sharia law by
							prohibiting interest (riba), excessive uncertainty (gharar), and gambling
							(maysir), while only allowing transactions with halal assets.
						</p>
					</section>

					{/* Key Features */}
					<section>
						<h2 className='text-3xl font-bold text-white mb-8 text-center'>Key Features</h2>
						<div className='grid md:grid-cols-2 gap-6'>
							<div className='bg-[#1a2e26] rounded-xl p-6 border border-[#23483c] hover:border-primary transition-colors'>
								<div className='text-primary text-3xl mb-4'>🕌</div>
								<h3 className='text-xl font-bold text-white mb-3'>Sharia Compliance</h3>
								<p className='text-gray-300'>
									All tokens and trading pairs are verified to ensure compliance with
									Islamic financial principles. Our Sharia Scanner validates each asset
									before it can be traded.
								</p>
							</div>

							<div className='bg-[#1a2e26] rounded-xl p-6 border border-[#23483c] hover:border-primary transition-colors'>
								<div className='text-primary text-3xl mb-4'>🔄</div>
								<h3 className='text-xl font-bold text-white mb-3'>Secure Swapping</h3>
								<p className='text-gray-300'>
									Trade cryptocurrencies directly from your wallet with our decentralized
									swap protocol. No intermediaries, no custody risks.
								</p>
							</div>

							<div className='bg-[#1a2e26] rounded-xl p-6 border border-[#23483c] hover:border-primary transition-colors'>
								<div className='text-primary text-3xl mb-4'>📊</div>
								<h3 className='text-xl font-bold text-white mb-3'>DCA Orders</h3>
								<p className='text-gray-300'>
									Dollar-Cost Averaging (DCA) allows you to invest gradually over time,
									reducing the impact of market volatility while maintaining Sharia compliance.
								</p>
							</div>

							<div className='bg-[#1a2e26] rounded-xl p-6 border border-[#23483c] hover:border-primary transition-colors'>
								<div className='text-primary text-3xl mb-4'>🔍</div>
								<h3 className='text-xl font-bold text-white mb-3'>Sharia Scanner</h3>
								<p className='text-gray-300'>
									Scan your wallet to discover which tokens align with Sharia principles and
									which don't. Our Sharia Scanner analyzes all tokens in your wallet, helping
									you identify halal assets and make informed trading decisions.
								</p>
							</div>
						</div>
					</section>

					{/* Why Choose Tayeb */}
					<section className='bg-gradient-to-r from-[#1a2e26] to-[#23483c] rounded-xl p-8 border border-primary/30'>
						<h2 className='text-3xl font-bold text-white mb-6'>Why Choose Tayeb?</h2>
						<div className='space-y-4'>
							<div className='flex items-start gap-4'>
								<div className='text-primary text-xl mt-1'>🚀</div>
								<div>
									<h3 className='text-lg font-semibold text-white mb-1'>Decentralized & Trustless</h3>
									<p className='text-gray-300'>
										Trade directly from your wallet without intermediaries. You maintain full control
										of your assets at all times, with no need to trust a centralized exchange.
									</p>
								</div>
							</div>
							<div className='flex items-start gap-4'>
								<div className='text-primary text-xl mt-1'>💰</div>
								<div>
									<h3 className='text-lg font-semibold text-white mb-1'>Low Fees & High Efficiency</h3>
									<p className='text-gray-300'>
										Benefit from competitive swap rates and minimal transaction fees. Our efficient
										AMM design ensures you get the best value for every trade.
									</p>
								</div>
							</div>
							<div className='flex items-start gap-4'>
								<div className='text-primary text-xl mt-1'>🌐</div>
								<div>
									<h3 className='text-lg font-semibold text-white mb-1'>Ethereum-Compatible</h3>
									<p className='text-gray-300'>
										Built on Moonbeam, you can use your existing Ethereum tools like MetaMask.
										No need to learn new interfaces or switch wallets.
									</p>
								</div>
							</div>
							<div className='flex items-start gap-4'>
								<div className='text-primary text-xl mt-1'>📈</div>
								<div>
									<h3 className='text-lg font-semibold text-white mb-1'>Smart Investment Tools</h3>
									<p className='text-gray-300'>
										Automate your investments with DCA orders, allowing you to build wealth gradually
										and reduce the impact of market volatility on your portfolio.
									</p>
								</div>
							</div>
						</div>
					</section>

					{/* Technology */}
					<section className='bg-[#1a2e26] rounded-xl p-8 border border-[#23483c]'>
						<h2 className='text-3xl font-bold text-white mb-6'>Built on Moonbeam</h2>
						<p className='text-lg text-gray-300 leading-relaxed mb-4'>
							Tayeb is built on Moonbeam, a Polkadot parachain that provides Ethereum compatibility.
							This means you can use familiar tools like MetaMask while benefiting from Polkadot's
							security and interoperability.
						</p>
						<p className='text-lg text-gray-300 leading-relaxed'>
							Our smart contracts are open-source and auditable, ensuring transparency and trust
							in every transaction. We leverage the power of decentralized finance while maintaining
							strict adherence to Islamic financial principles.
						</p>
					</section>

					{/* Call to Action */}
					<section className='text-center bg-gradient-to-r from-primary/10 to-[#23483c] rounded-xl p-8 border border-primary/30'>
						<h2 className='text-3xl font-bold text-white mb-4'>Ready to Start Trading?</h2>
						<p className='text-lg text-gray-300 mb-6 max-w-xl mx-auto'>
							Join the first fully Sharia-compliant DEX and start trading halal cryptocurrencies today.
						</p>
						<div className='flex gap-4 justify-center flex-wrap'>
							<button
								onClick={() => navigate("/swap")}
								className='px-8 py-3 bg-primary text-background-dark font-bold rounded-lg hover:opacity-90 transition-opacity'
							>
								Start Swapping
							</button>
							<button
								onClick={() => navigate("/tokens")}
								className='px-8 py-3 bg-[#23483c] text-white font-bold rounded-lg hover:bg-[#2c5a4b] transition-colors'
							>
								View Tokens
							</button>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
