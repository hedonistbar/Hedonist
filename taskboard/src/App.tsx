import { useState } from "react";
import "./App.css";
import { useAuth } from "./lib/useAuth";
import { AuthScreen } from "./screens/AuthScreen";
import { BoardsScreen } from "./screens/BoardsScreen";
import { BoardScreen } from "./screens/BoardScreen";
import type { Board } from "./lib/database.types";

export default function App() {
  const { user, loading } = useAuth();
  const [openBoard, setOpenBoard] = useState<Board | null>(null);

  if (loading) {
    return <div className="spinner-screen">Загрузка…</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (openBoard) {
    return <BoardScreen board={openBoard} userId={user.id} onBack={() => setOpenBoard(null)} />;
  }

  return <BoardsScreen onOpenBoard={setOpenBoard} />;
}
