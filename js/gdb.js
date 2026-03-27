async function inserirDados(dados, base) {
    // EXCLUIR
}

async function recuperarDado(base, chave) {

    if (chave === undefined || chave === null)
        return null

    const resposta = await fetch(`${api}/recuperar-dado`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ base, chave })
    })

    if (!resposta.ok)
        throw new Error('Erro na requisição')

    return await resposta.json()
}

async function pesquisarDB({
    base,
    filtros = {},
    pagina = 1,
    limite = 50,
    explode = null
}) {
    const resposta = await fetch(`${api}/pesquisar-db`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            base,
            filtros,
            pagina,
            limite,
            explode
        })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao pesquisar')
    }

    return await resposta.json()
}

async function contarPorCampo({
    base,
    path,
    filtros = {},
    explode = null
}) {
    const resposta = await fetch(`${api}/contar-por-campo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            base,
            path,
            filtros,
            explode
        })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}

async function deletar(caminho, idEvento) {

    const url = `${api}/deletar`

    const objeto = {
        caminho,
        usuario: acesso.usuario
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        if (idEvento) removerOffline('deletar', idEvento)

        return data
    } catch (erro) {
        console.error(`Erro ao tentar deletar '${caminho}':`, erro.message || erro)
        salvarOffline(objeto, 'deletar', idEvento)
        removerOverlay()
        return null
    }
}

async function enviar(caminho, info, idEvento) {
    const url = `${api}/salvar`
    const objeto = { caminho, valor: info };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            // Erro ao tentar interpretar como JSON;
            console.error("Resposta não é JSON válido:", parseError);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (!response.ok) {
            // Se a API respondeu erro (ex: 400, 500);
            console.error("Erro HTTP:", response.status, data);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (idEvento) removerOffline('enviar', idEvento);

        return data;
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        salvarOffline(objeto, 'enviar', idEvento);
        return null;
    }
}

function removerOffline(operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline'))
    delete dados_offline?.[operacao]?.[idEvento]
    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

function salvarOffline(objeto, operacao, idEvento) {
    const dadosOffline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    idEvento = idEvento || ID5digitos()

    dadosOffline[operacao] ??= {}
    dadosOffline[operacao][idEvento] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dadosOffline))
}

function msgQuedaConexao(msg = '<b>Falha na atualização:</b> tente novamente em alguns minutos.') {

    const elemento = `
            <div class="msg-queda-conexao">
                <img src="gifs/alerta.gif" style="width: 2rem;">
                <span>${msg}</span>
            </div>
        `
    const msgAtiva = document.querySelector('.msg-queda-conexao')
    if (msgAtiva) return
    popup({ elemento })
}

function toTimestamp(d, fimDoDia = false) {
    if (d == null || d === '') return null
    if (typeof d === 'number') return d

    const str = String(d).trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, dia] = str.split('-').map(Number)
        return fimDoDia
            ? new Date(y, m - 1, dia, 23, 59, 59, 999).getTime()
            : new Date(y, m - 1, dia, 0, 0, 0, 0).getTime()
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        const t = Date.parse(str)
        return isNaN(t) ? null : t
    }

    const br = str.match(
        /^(\d{2})\/(\d{2})\/(\d{4})(?:,\s*(\d{2}):(\d{2})(?::(\d{2}))?)?/
    )

    if (br) {
        const [, dia, mes, ano, h = '00', min = '00', s = '00'] = br
        return new Date(
            Number(ano),
            Number(mes) - 1,
            Number(dia),
            Number(h),
            Number(min),
            Number(s)
        ).getTime()
    }

    const t = Date.parse(str)
    return isNaN(t) ? null : t
}