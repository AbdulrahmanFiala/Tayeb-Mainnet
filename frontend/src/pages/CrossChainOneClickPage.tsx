import { CrossChainOneClickCard } from "../components/CrossChainOneClickCard";

export function CrossChainOneClickPage() {
	return (
		<main className='flex flex-1 justify-center py-10 sm:py-16 px-4'>
			<div className='flex flex-col w-full max-w-lg'>
				<h1 className='text-white tracking-light text-[32px] font-bold leading-tight text-center pb-6'>
					One‑Click Cross‑Chain Swap
				</h1>
				<CrossChainOneClickCard />
			</div>
		</main>
	);
}

