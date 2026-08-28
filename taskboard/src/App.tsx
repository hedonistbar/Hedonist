import { useState } from "react";
import "./App.css";
import { useAuth } from "./lib/useAuth";
import { useIsMobile } from "./lib/useIsMobile";
import { AuthScreen } from "./screens/AuthScreen";
import { BoardsScreen } from "./screens/BoardsScreen";
import { BoardScreen } from "./screens/BoardScreen";
import { MobileApp } from "./screens/MobileApp";
import type { Board } from "./lib/database.types";

function BlobBackdrop() {
  return (
    <div className="blob-bg" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [openBoard, setOpenBoard] = useState<Board | null>(null);
  // Phones get the reference design's own navigation (bottom tab bar,
  // Home/Projects/Calendar/Profile) — not a skin over the kanban board.
  // Desktop keeps the board with drag & drop between lists, where a tab
  // bar wouldn't make sense and there's room for columns.
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="spinner-screen">Загрузка…</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (isMobile) {
    return (
      <>
        <BlobBackdrop />
        <MobileApp userId={user.id} email={user.email ?? null} />
      </>
    );
  }

  return (
    <>
      <BlobBackdrop />
      {openBoard ? (
        <BoardScreen board={openBoard} userId={user.id} onBack={() => setOpenBoard(null)} />
      ) : (
        <BoardsScreen onOpenBoard={setOpenBoard} />
      )}
    </>
  );
}
