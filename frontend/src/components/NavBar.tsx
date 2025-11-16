import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useWallet } from "../hooks/useWallet";
import { WalletConnectModal } from "./WalletConnectModal";
import { WalletAccountModal } from "./WalletAccountModal";

export const NavBar: React.FC = () => {
	const { address, isConnected } = useWallet();
	const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
	const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();

	const shortenAddress = (addr: string) => {
		return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
	};

	// Check if a route is active
	const isActive = (path: string) => {
		if (path === "/") {
			return location.pathname === "/";
		}
		return location.pathname.startsWith(path);
	};

	// Get nav button classes based on active state
	const getNavButtonClasses = (path: string) => {
		const baseClasses = "text-base font-medium leading-normal transition-colors bg-transparent border-b-2 focus:outline-none";
		if (isActive(path)) {
			return `${baseClasses} text-white border-primary`;
		}
		return `${baseClasses} text-white/70 border-transparent hover:text-primary hover:border-primary`;
	};

	return (
		<header className='w-full flex justify-center px-4 sm:px-8 lg:px-10'>
			<nav className='flex items-center justify-between w-full py-4'>
				<div className='flex items-center gap-4 text-white'>
					<div className='size-6 text-primary'>
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
					<h2 className='text-white text-xl font-bold leading-tight'>Tayeb</h2>
				</div>

				<div className='hidden md:flex items-center gap-9'>
					<button
						onClick={() => navigate("/")}
						className={getNavButtonClasses("/")}
					>
						Home
					</button>
					<button
						onClick={() => navigate("/tokens")}
						className={getNavButtonClasses("/tokens")}
					>
						Tokens
					</button>
					<button
						onClick={() => navigate("/swap")}
						className={getNavButtonClasses("/swap")}
					>
						Swap
					</button>
					<button
						onClick={() => navigate("/xcm-oneclick")}
						className={getNavButtonClasses("/xcm-oneclick")}
					>
						XCM One‑Click
					</button>
					<button
						onClick={() => navigate("/scanner")}
						className={getNavButtonClasses("/scanner")}
					>
						Scanner
					</button>
					<button
						onClick={() => navigate("/dca")}
						className={getNavButtonClasses("/dca")}
					>
						DCA
					</button>
					<button
						onClick={() => navigate("/about")}
						className={getNavButtonClasses("/about")}
					>
						About
					</button>
				</div>

				<div className='flex items-center gap-4'>
					{isConnected ? (
						<div className='flex items-center gap-2'>
							<button
								onClick={() => setIsAccountModalOpen(true)}
								className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 px-4 bg-primary text-background-dark text-sm font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity'
							>
								{shortenAddress(address || "")}
							</button>
						</div>
					) : (
						<button
							onClick={() => setIsWalletModalOpen(true)}
							className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 px-4 bg-primary text-background-dark text-sm font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity'
						>
							Connect Wallet
						</button>
					)}
					<button className='flex md:hidden p-2 text-white bg-transparent border-transparent hover:border-transparent hover:border-b-2 hover:outline-0 focus:outline-none'>
						<span
							className='material-symbols-outlined'
							style={{ fontSize: "28px" }}
						>
							menu
						</span>
					</button>
				</div>
			</nav>
			
			{/* Wallet Connection Modal */}
			<WalletConnectModal
				isOpen={isWalletModalOpen}
				onClose={() => setIsWalletModalOpen(false)}
			/>
			
			{/* Wallet Account Modal */}
			<WalletAccountModal
				isOpen={isAccountModalOpen}
				onClose={() => setIsAccountModalOpen(false)}
			/>
		</header>
	);
};
