import { useNavigate } from "react-router";

export function HomePage() {
	const navigate = useNavigate();

	return (
		<div className='flex-1 flex flex-col items-center justify-center py-16 px-4'>
			<div className='text-center max-w-2xl'>
				<div className='mb-8'>
					<div className='inline-block size-12 text-primary mb-4'>
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
				</div>
				<h1 className='text-5xl font-bold text-white mb-4'>Welcome to Tayeb</h1>
				<p className='text-xl text-[#92c9b7] mb-8'>
					The First Fully Sharia-Compliant DEX for Halal Crypto Trading
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
			</div>
		</div>
	);
}
