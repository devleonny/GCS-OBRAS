const replace = require("replace-in-file");

(async () => {
  const timestamp = Date.now();

  try {
    const results = await replace({
      files: "index.html",
      from: [
        /<link([^>]+href="[^"]+\.css)(\?v=\d+)?"/g,
        /<script([^>]+src="[^"]+\.js)(\?v=\d+)?"/g
      ],
      to: (match, p1) => `${p1}?v=${timestamp}"`,
    });

    console.log("Cache buster aplicado:", results);
  } catch (error) {
    console.error("Erro ao aplicar cache buster:", error);
  }
})();
