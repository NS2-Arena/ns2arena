type Lifeform = "Skulk" | "Gorge" | "Lerk" | "Fade" | "Onos";

type Player = {
  id: string;
  name: string;
  lifeforms: Lifeform[];
};

const players: Readonly<Player>[] = [
  {
    id: "1",
    name: "asdf",
    lifeforms: ["Skulk", "Fade", "Lerk"],
  },
  {
    id: "2",
    name: "fdsa",
    lifeforms: ["Skulk", "Fade", "Lerk"],
  },
];

export const PlayNow = () => {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      Players:
      {players.map((player) => (
        <p key={player.id}>
          {player.name} ({player.lifeforms.join(", ")})
        </p>
      ))}
    </div>
  );
};
