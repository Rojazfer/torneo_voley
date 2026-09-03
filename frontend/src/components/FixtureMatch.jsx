export default function FixtureMatch({ partido, equiposById = {}, highlightEquipoId = '' }) {
  const local = buildTeamSide(partido, equiposById, 'local');
  const visitante = buildTeamSide(partido, equiposById, 'visitante');

  return (
    <div className="fixture-match">
      <TeamSide team={local} highlightEquipoId={highlightEquipoId} />
      <span className="fixture-vs">vs</span>
      <TeamSide team={visitante} highlightEquipoId={highlightEquipoId} />
    </div>
  );
}

function TeamSide({ team, highlightEquipoId }) {
  const highlighted = highlightEquipoId && String(team.id) === String(highlightEquipoId);

  return (
    <span className={`fixture-side ${highlighted ? 'highlight-text' : ''}`}>
      {team.logo ? (
        <img className="fixture-team-logo" src={team.logo} alt={team.name} />
      ) : (
        <span className="fixture-team-logo placeholder">{getInitials(team.name)}</span>
      )}
      <span>{team.name}</span>
    </span>
  );
}

function buildTeamSide(partido, equiposById, side) {
  const id = side === 'local' ? partido.equipo_local : partido.equipo_visitante;
  const equipo = equiposById[String(id)];
  const name = side === 'local' ? partido.equipo_local_nombre : partido.equipo_visitante_nombre;
  const logo = side === 'local' ? partido.equipo_local_logo : partido.equipo_visitante_logo;

  return {
    id,
    name: name || equipo?.nombre || 'Equipo',
    logo: logo || equipo?.logo_data_url || '',
  };
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
