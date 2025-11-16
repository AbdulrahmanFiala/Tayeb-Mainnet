import { useState, useRef, useEffect, useMemo } from "react";
import type { Token } from "../types";
import { CryptoTokenIcon } from "./CryptoTokenIcon";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";

interface TokenSelectorProps {
	selectedToken: Token | null;
	tokens: Token[];
	onTokenChange: (token: Token) => void;
	disabled?: boolean;
}

export function TokenSelector({
	selectedToken,
	tokens,
	onTokenChange,
	disabled = false,
}: TokenSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
				setSearchQuery(""); // Clear search when closing
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Filter tokens based on search query
	const filteredTokens = useMemo(() => {
		if (!searchQuery.trim()) {
			return tokens;
		}
		const query = searchQuery.toLowerCase().trim();
		return tokens.filter(
			(token) =>
				token.symbol.toLowerCase().includes(query) ||
				token.name.toLowerCase().includes(query)
		);
	}, [tokens, searchQuery]);

	const handleTokenSelect = (token: Token) => {
		onTokenChange(token);
		setIsOpen(false);
		setSearchQuery(""); // Clear search after selection
	};

	return (
		<div className="relative" ref={dropdownRef}>
			{/* Dropdown Button */}
			<button
				type="button"
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}
				className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#252525] transition-colors rounded-full pl-2 pr-4 py-2 border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{selectedToken && (
					<CryptoTokenIcon
						symbol={selectedToken.symbol}
						className="size-8"
					/>
				)}
				<span className="text-white font-bold text-base">
					{selectedToken ? formatTokenSymbolForDisplay(selectedToken.symbol) : "SELECT"}
				</span>
				<svg
					className={`w-4 h-4 text-white/60 transition-transform ${
						isOpen ? "rotate-180" : ""
					}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div className="absolute top-full mt-2 right-0 w-80 sm:w-96 bg-[#1a3a2f] border border-[#23483c] rounded-xl shadow-xl overflow-hidden z-50">
					<div className="p-2">
						<div className="text-white/60 text-xs uppercase font-medium px-3 py-2">
							Select Token
						</div>
						{/* Search Input */}
						<div className="px-3 pb-2">
							<div className="relative">
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search tokens..."
									className="w-full bg-[#23483c] border border-[#2c5a4b] rounded-lg px-3 py-2 pl-9 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
									autoFocus
								/>
								<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-lg">
									search
								</span>
							</div>
						</div>
						<div className="max-h-64 overflow-y-auto">
							{filteredTokens.length > 0 ? (
								filteredTokens.map((token) => (
								<button
									key={token.addresses.moonbeam}
									type="button"
									onClick={() => handleTokenSelect(token)}
									className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#23483c] transition-colors ${
										selectedToken?.addresses.moonbeam ===
										token.addresses.moonbeam
											? "bg-[#23483c]"
											: ""
									}`}
								>
									<CryptoTokenIcon
										symbol={token.symbol}
										className="size-8"
									/>
									<div className="flex-1 text-left">
										<div className="text-white font-bold text-sm">
											{formatTokenSymbolForDisplay(token.symbol)}
										</div>
										<div className="text-white/60 text-xs truncate">
											{token.name}
										</div>
									</div>
									{selectedToken?.addresses.moonbeam ===
										token.addresses.moonbeam && (
										<svg
											className="w-5 h-5 text-primary"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
									)}
								</button>
								))
							) : (
								<div className="px-3 py-8 text-center text-white/40 text-sm">
									No tokens found
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

