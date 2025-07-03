





async function baseLeankeep() {
    return new Promise((resolve, reject) => {

        fetch("https://leonny.dev.br/leankeep", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                data = JSON.parse(data)
                resolve(data);
            })
            .catch(err => 
                reject({})
            )
    })
}