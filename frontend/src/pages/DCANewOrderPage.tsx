import { useState } from "react";
import { useNavigate } from "react-router";

export const DCANewOrderPage: React.FC = () => {
	const navigate = useNavigate();
	const [sourceType, setSourceType] = useState<"token" | "dev">("token");
	const [amount, setAmount] = useState("");
	const [intervals, setIntervals] = useState("24");

	return (
		<main className='flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 lg:px-10 py-10 sm:py-16'>
			<div className='text-center mb-10'>
				<h1 className='text-4xl sm:text-5xl font-bold mb-3 tracking-tight'>
					Create a New DCA Order
				</h1>
				<p className='text-lg text-white/70 max-w-2xl mx-auto'>
					Follow the steps below to set up your automated investment strategy.
				</p>
			</div>

			<div className='bg-surface rounded-xl border border-white/10 p-6 sm:p-8'>
				{/* Progress Steps */}
				<div className='mb-8'>
					<div className='flex items-center text-sm font-medium text-white/50'>
						<div className='flex items-center text-accent'>
							<div className='size-6 rounded-full bg-accent text-background-dark flex items-center justify-center font-bold'>
								1
							</div>
							<span className='ml-2'>Source</span>
						</div>
						<div className='flex-1 h-px bg-white/20 mx-3' />
						<div className='flex items-center'>
							<div className='size-6 rounded-full border-2 border-white/30 flex items-center justify-center'>
								2
							</div>
							<span className='ml-2'>Target</span>
						</div>
						<div className='flex-1 h-px bg-white/20 mx-3' />
						<div className='flex items-center'>
							<div className='size-6 rounded-full border-2 border-white/30 flex items-center justify-center'>
								3
							</div>
							<span className='ml-2'>Amount</span>
						</div>
						<div className='flex-1 h-px bg-white/20 mx-3' />
						<div className='flex items-center'>
							<div className='size-6 rounded-full border-2 border-white/30 flex items-center justify-center'>
								4
							</div>
							<span className='ml-2'>Schedule</span>
						</div>
						<div className='flex-1 h-px bg-white/20 mx-3' />
						<div className='flex items-center'>
							<div className='size-6 rounded-full border-2 border-white/30 flex items-center justify-center'>
								5
							</div>
							<span className='ml-2'>Confirm</span>
						</div>
					</div>
				</div>

				{/* Form Grid */}
				<div className='grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8'>
					{/* Left Column: Form Inputs */}
					<div className='space-y-6'>
						{/* Step 1: Select Source */}
						<div>
							<label className='block text-sm font-medium text-white/90 mb-2'>
								1. Select Source
							</label>
							<div className='flex gap-4 mb-3'>
								<label className='flex-1 p-3 bg-background-dark/50 border border-accent rounded-lg cursor-pointer'>
									<input
										checked={sourceType === "token"}
										className='form-radio text-accent bg-transparent border-white/30 focus:ring-accent'
										name='source_type'
										type='radio'
										onChange={() => setSourceType("token")}
									/>
									<span className='ml-2 font-medium'>Token</span>
								</label>
								<label className='flex-1 p-3 bg-background-dark/50 border border-white/20 hover:border-white/40 rounded-lg cursor-pointer'>
									<input
										checked={sourceType === "dev"}
										className='form-radio text-accent bg-transparent border-white/30 focus:ring-accent'
										name='source_type'
										type='radio'
										onChange={() => setSourceType("dev")}
									/>
									<span className='ml-2 font-medium'>DEV</span>
								</label>
							</div>
							<select className='w-full bg-background-dark border border-white/20 rounded-lg px-3 py-2.5 text-base focus:ring-accent focus:border-accent'>
								<option>Select source token</option>
								<option selected>Ethereum (ETH)</option>
								<option>USD Coin (USDC)</option>
							</select>
						</div>

						{/* Step 2: Select Target Token */}
						<div>
							<label
								className='block text-sm font-medium text-white/90 mb-2'
								htmlFor='target_token'
							>
								2. Select Target Token
							</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
									<div
										className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-6 border-2 border-surface'
										style={{
											backgroundImage:
												'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA28IgkZKvEPhYeIh1kCQ1HNnXd-hkBIrOY2nsPi92AR77Enepjia3sELhMvY8VM4P7BcWoWaFOPtLTSacJKDM07k3_3A8MrpSGkjRBZjjdkLtshnZ6Kz60VMo5hU-uyuvg0oF2bEGdGjwVyoqyIy2Tp9WfCNYTZbLeTSAxlIJBYp4pbSt1rosqFgDKW6fAGpl6yaqkHWYjWQgGg20RlTnhpaY112ayxZtEN4eOgp6iQHX_X_WhA4j4JqWRBaw8bXPk5EXsOCqChPc")',
										}}
									/>
								</div>
								<select
									className='w-full bg-background-dark border border-white/20 rounded-lg pl-11 pr-3 py-2.5 text-base focus:ring-accent focus:border-accent appearance-none'
									id='target_token'
								>
									<option>Select target token</option>
									<option selected>Wrapped Bitcoin (WBTC)</option>
									<option>Tayeb Governance (TAYEB)</option>
								</select>
								<div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
									<span
										className='material-symbols-outlined text-white/50'
										style={{ fontSize: "20px" }}
									>
										expand_more
									</span>
								</div>
							</div>
							<p className='text-xs text-green-400/80 mt-1.5 flex items-center gap-1.5'>
								<span
									className='material-symbols-outlined'
									style={{ fontSize: "14px" }}
								>
									verified
								</span>
								Sharia-compliant token
							</p>
						</div>

						{/* Step 3: Set Investment Amount */}
						<div>
							<div className='flex justify-between items-baseline mb-2'>
								<label
									className='block text-sm font-medium text-white/90'
									htmlFor='amount'
								>
									3. Set Investment Amount (per interval)
								</label>
								<span className='text-xs text-white/60'>Balance: 12.5 ETH</span>
							</div>
							<div className='relative'>
								<input
									className='w-full bg-background-dark border border-white/20 rounded-lg px-3 py-2.5 text-base focus:ring-accent focus:border-accent'
									id='amount'
									placeholder='0.00'
									type='number'
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
								/>
								<div className='absolute inset-y-0 right-0 flex items-center pr-3'>
									<span className='text-white/70 font-medium'>ETH</span>
									<button className='ml-2 text-accent text-xs font-bold hover:underline'>
										MAX
									</button>
								</div>
							</div>
							<p className='text-xs text-yellow-400/80 mt-1.5 flex items-center gap-1.5'>
								<span
									className='material-symbols-outlined'
									style={{ fontSize: "14px" }}
								>
									warning
								</span>
								Minimum investment is 0.01 ETH.
							</p>
						</div>

						{/* Step 4: Interval and Duration */}
						<div className='grid grid-cols-2 gap-4'>
							<div>
								<label
									className='block text-sm font-medium text-white/90 mb-2'
									htmlFor='interval_duration'
								>
									4a. Interval Duration
								</label>
								<select
									className='w-full bg-background-dark border border-white/20 rounded-lg px-3 py-2.5 text-base focus:ring-accent focus:border-accent'
									id='interval_duration'
								>
									<option>Daily</option>
									<option selected>Weekly</option>
									<option>Bi-weekly</option>
									<option>Monthly</option>
								</select>
							</div>
							<div>
								<label
									className='block text-sm font-medium text-white/90 mb-2'
									htmlFor='total_intervals'
								>
									4b. Total Intervals
								</label>
								<input
									className='w-full bg-background-dark border border-white/20 rounded-lg px-3 py-2.5 text-base focus:ring-accent focus:border-accent'
									id='total_intervals'
									max='100'
									min='1'
									type='number'
									value={intervals}
									onChange={(e) => setIntervals(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{/* Right Column: Review Order */}
					<div className='bg-background-dark rounded-lg p-6 flex flex-col h-full border border-white/10'>
						<h3 className='text-xl font-bold mb-4'>Review Order</h3>
						<div className='space-y-3 text-sm flex-1'>
							<div className='flex justify-between items-center'>
								<span className='text-white/60'>Source</span>
								<div className='flex items-center gap-2 font-medium'>
									<div
										className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-5'
										style={{
											backgroundImage:
												'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCQbdFt5RfBEV8a6btZAY_aHj6uNAfMm7-VOQ4t1_303bOi_8Pc-6HtFCA1wrKDWJI_SRrK2Zlb3ZPeXRrmaux0g7WpD1HDJikidmS1Q3rNUCnEkhEcW1yEF9Uakzx1mEmhhuEEDQ77_emOUpjkpzTHPw56m4Y7pmynJc7NeTA00uitJGHC0tQwyNb1tTlYBlmuSeSVyUQFATn8F0QXuGmDvgNDrwSSWmKTOFlSWgcDw9_TdvweEwpQ8vZFX-2wOXGlzAgG93OgLvY")',
										}}
									/>
									<span>ETH</span>
								</div>
							</div>
							<div className='flex justify-between items-center'>
								<span className='text-white/60'>Target</span>
								<div className='flex items-center gap-2 font-medium'>
									<div
										className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-5'
										style={{
											backgroundImage:
												'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA28IgkZKvEPhYeIh1kCQ1HNnXd-hkBIrOY2nsPi92AR77Enepjia3sELhMvY8VM4P7BcWoWaFOPtLTSacJKDM07k3_3A8MrpSGkjRBZjjdkLtshnZ6Kz60VMo5hU-uyuvg0oF2bEGdGjwVyoqyIy2Tp9WfCNYTZbLeTSAxlIJBYp4pbSt1rosqFgDKW6fAGpl6yaqkHWYjWQgGg20RlTnhpaY112ayxZtEN4eOgp6iQHX_X_WhA4j4JqWRBaw8bXPk5EXsOCqChPc")',
										}}
									/>
									<span>WBTC</span>
								</div>
							</div>
							<div className='flex justify-between items-center'>
								<span className='text-white/60'>Investment / Interval</span>
								<span className='font-medium'>{amount || "0"} ETH</span>
							</div>
							<div className='flex justify-between items-center'>
								<span className='text-white/60'>Interval</span>
								<span className='font-medium'>Weekly</span>
							</div>
							<div className='flex justify-between items-center'>
								<span className='text-white/60'>Total Intervals</span>
								<span className='font-medium'>{intervals}</span>
							</div>
							<div className='pt-3 border-t border-white/10'>
								<div className='flex justify-between items-center font-bold text-base'>
									<span className='text-white/80'>Total Investment</span>
									<span>
										{(parseFloat(amount || "0") * parseInt(intervals)).toFixed(
											2
										)}{" "}
										ETH
									</span>
								</div>
								<div className='flex justify-between items-center text-xs text-white/60 mt-1'>
									<span className='text-white/60'>Order Duration</span>
									<span>~ {Math.ceil(parseInt(intervals) / 4)} Weeks</span>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className='mt-6 flex flex-col sm:flex-row gap-3'>
							<button className='w-full text-center py-3 rounded-lg bg-surface hover:bg-white/5 transition-colors text-sm font-bold'>
								Back
							</button>
							<button className='w-full text-center py-3 rounded-lg bg-accent text-background-dark hover:opacity-90 transition-opacity text-sm font-bold'>
								Create Order
							</button>
						</div>
						<button
							onClick={() => navigate("/dca")}
							className='w-full text-center mt-3 text-sm text-white/60 hover:text-white'
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</main>
	);
};
