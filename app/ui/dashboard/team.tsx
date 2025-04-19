import TeamMember from './team-member';

export default function Team({ team }: { team: Array<string | null> }) {
  if (team[0] === null || team[0] === undefined) {
    return <TeamMember teamMember="Unassigned" />;
  } else {
    return team.map((teamMember: string | null, index) => {
      if (teamMember === null) return;
      return <TeamMember teamMember={teamMember} key={index} />;
    });
  }
}
