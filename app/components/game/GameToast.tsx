import "./GameToast.css";

type GameToastProps = {
  message: string;
  onClose: () => void;
};

export default function GameToast({ message, onClose }: GameToastProps) {
  return (
    <div className="game-toast" role="alert">
      <span className="game-toast-icon" aria-hidden="true">!</span>
      <div className="game-toast-content">
        <strong>Obavijest</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="game-toast-close" aria-label="Zatvori obavijest" onClick={onClose}>×</button>
    </div>
  );
}
