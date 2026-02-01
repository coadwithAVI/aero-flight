// ==========================================
// PATH: ui/leaderboard-ui.js
// ==========================================

class LeaderboardUI {
  constructor() {
    this.box = document.createElement("div");
    Object.assign(this.box.style, {
      position: "absolute",
      top: "20px",
      right: "1100px",
      background: "rgba(0,0,0,0.5)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "12px",
      padding: "12px 14px",
      color: "white",
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      minWidth: "200px",
      zIndex: 120
    });

    this.box.innerHTML = "<b>LEADERBOARD</b><div id='lbLines'></div>";
    document.body.appendChild(this.box);

    this.lines = this.box.querySelector("#lbLines");
  }

  update(rows) {
    if (!this.lines) return;
    this.lines.innerHTML = rows.map((r, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
      return `<div style="margin-top:6px">${medal} ${r.name} : ${r.score}</div>`;
    }).join("");
  }
}

window.LeaderboardUI = LeaderboardUI;
