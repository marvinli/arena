import styles from "./StartScreen.module.css";

export function StartScreen({
  onStart,
  error,
}: {
  onStart: () => void;
  error: string | null;
}) {
  return (
    <div className={styles.container}>
      <button type="button" className={styles.startButton} onClick={onStart}>
        Start Game
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
