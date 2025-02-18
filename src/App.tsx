import "./App.css";
import CanvasVideoPlayer from "./components/CanvasPlayer";

function App() {
  return (
    <main className="min-h-screen min-w-full bg-gradient-to-br from-gray-100 to-gray-300 py-16">
      <div className="mx-auto px-4">
        <CanvasVideoPlayer />
      </div>
    </main>
  );
}

export default App;
