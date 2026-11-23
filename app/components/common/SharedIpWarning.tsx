import "./SharedIpWarning.css";

type Props = { visible?: boolean };

export default function SharedIpWarning({ visible }: Props) {
  if (!visible) return null;
  return (
    <span
      className="shared-ip-warning"
      role="img"
      aria-label="Ista IP adresa kao drugi igrač u sobi"
      title="Ovaj igrač dijeli IP adresu s drugim igračem u sobi. To ne mora značiti varanje."
      onClick={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path d="M12 3 22 20H2L12 3Z" fill="#f6b943" stroke="#8b590b" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M12 9v5" stroke="#493006" strokeWidth="2.4" strokeLinecap="round"/>
        <circle cx="12" cy="17" r="1.25" fill="#493006"/>
      </svg>
    </span>
  );
}
