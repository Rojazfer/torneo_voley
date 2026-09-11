export default function PositionTeamCell({ name, logoSrc = '', highlighted = false }) {
  const displayName = name || 'Equipo';

  return (
    <span className={`position-team ${highlighted ? 'highlight-text' : ''}`}>
      {logoSrc ? (
        <img className="position-team-logo" src={logoSrc} alt={displayName} />
      ) : (
        <span className="position-team-logo placeholder">{getInitials(displayName)}</span>
      )}
      <span className="position-team-name">{displayName}</span>
    </span>
  );
}

function getInitials(value) {
  return String(value || 'EQ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}
