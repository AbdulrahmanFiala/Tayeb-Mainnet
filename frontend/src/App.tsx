import { Route, Routes } from "react-router";
import "./App.css";
import { NavBar } from "./components/NavBar";
import { AboutPage } from "./pages/AboutPage";
import { DCAOrdersPage } from "./pages/DCAOrdersPage";
import { HomePage } from "./pages/HomePage";
import { SwapPage } from "./pages/SwapPage";
import { TokensPage } from "./pages/TokensPage";
import { ShariaScannerPage } from "./pages/ShariaScannerPage";
import { CrossChainOneClickPage } from "./pages/CrossChainOneClickPage";
import { HydraQuotePage } from "./pages/HydraQuotePage";

function App() {
	return (
		<div className='dark bg-background-dark min-h-screen flex flex-col font-display'>
			<NavBar />
			<Routes>
				<Route path='/' element={<HomePage />} />
				<Route path='/swap' element={<SwapPage />} />
				<Route path='/xcm-oneclick' element={<CrossChainOneClickPage />} />
				<Route path='/hydra-quote' element={<HydraQuotePage />} />
				<Route path='/tokens' element={<TokensPage />} />
				<Route path='/scanner' element={<ShariaScannerPage />} />
				<Route path='/dca' element={<DCAOrdersPage />} />
				<Route path='/about' element={<AboutPage />} />
			</Routes>
		</div>
	);
}

export default App;
