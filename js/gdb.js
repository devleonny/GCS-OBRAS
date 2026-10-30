async function recuperarDado(base, chave) {
    if (chave === undefined || chave === null)
        return {}

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

        const resposta = await fetch(`${read}/recuperar-dado`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ base, chave })
        })

        const texto = await resposta.text()

        let payload = {}

        if (texto.trim()) {
            try {
                payload = JSON.parse(texto)
            } catch {
                payload = { mensagem: texto }
            }
        }

        if (!resposta.ok) {
            const mensagem = payload?.mensagem || payload?.erro || texto || 'Erro desconhecido'
            console.error('Erro em recuperarDado:', mensagem, payload)

            if (mensagem.toLowerCase().includes('inválido') || mensagem.toLowerCase().includes('invalido'))
                location.reload()

            return null
        }

        return payload && typeof payload === 'object'
            ? payload
            : null

    } catch (erro) {
        console.error('Falha no recuperarDado:', erro)
        return null
    }
}

async function pesquisarDB(params) {
    const acessoStr = localStorage.getItem('acesso') || '{}'
    const { token } = JSON.parse(acessoStr)

    const resposta = await fetch(`${read}/pesquisar-db`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params)
    })

    if (!resposta.ok) {
        // tenta ler JSON primeiro
        let erroTexto = ''
        let payload = null

        const contentType = resposta.headers.get('Content-Type') || ''

        try {

            if (contentType.includes('application/json')) {
                payload = await resposta.json()
                erroTexto = payload?.erro || JSON.stringify(payload)
            } else {
                erroTexto = await resposta.text()
            }

        } catch {
            // fallback se der erro ao ler body
            erroTexto = 'Erro ao pesquisar'
        }

        // trata especificamente token inválido (401 + mensagem)
        const tokenInvalido =
            resposta.status === 401 &&
            (
                payload?.erro?.toLowerCase().includes('token') ||
                erroTexto.toLowerCase().includes('token inválido') ||
                erroTexto.toLowerCase().includes('token invalido')
            )

        if (tokenInvalido) {
            location.reload()
            popup({ mensagem: 'Sessão expirada, faça login novamente' })

            throw new Error('Acesso expirado')
        }

        throw new Error(erroTexto || 'Erro ao pesquisar')
    }

    return await resposta.json()
}

async function baixarRelatorioExcel(dados = null) {

    if (!dados)
        return

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const response = await fetch(`${read}/excel`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

    if (!response.ok) {
        const erro = await response.json()
        popup({ mensagem: erro.mensagem || 'Erro ao exportar' })
        return
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = dados?.titulo || `relatorio-${Date.now()}.xlsx`
    document.body.appendChild(a)
    a.click()

    a.remove()
    window.URL.revokeObjectURL(url)
}


async function contarPorCampo(params) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${read}/contar-por-campo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(params)
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}

// A linha excluída só some quando o servidor termina de atualizar e avisa as telas, o que às vezes
// demora. Enquanto isso ela fica bloqueada com "Excluindo item...". O bloqueio vai embora sozinho
// quando a tela redesenha a linha; se a exclusão falhar (ou a tela não redesenhar), é retirado.
// Itens que não são <tr>, pela coleção do caminho (ex.: dados_ocorrencias/ID/correcoes/ID).
const CARTOES_EXCLUIVEIS = { correcoes: '.detalhes-correcoes-1' }
const LIMITE_BLOQUEIO_EXCLUSAO_MS = 45 * 1000

function bloquearItensExclusao(caminho) {
    const partes = String(caminho).split('/')
    const chave = partes.at(-1)
    if (partes.length < 2 || !chave) return () => {}

    // Linha da tabela com a mesma chave; senão, o cartão que traz o id (botões de editar/excluir).
    const alvos = [...document.querySelectorAll(`tr[data-id="${CSS.escape(chave)}"]`)]
    const cartao = CARTOES_EXCLUIVEIS[partes.at(-2)]
    if (!alvos.length && cartao)
        alvos.push(...[...document.querySelectorAll(cartao)].filter(item => item.innerHTML.includes(`'${chave}'`)))

    const bloqueios = alvos.map(alvo => {
        const overlay = document.createElement('div')
        overlay.className = 'item-excluindo'
        overlay.innerHTML = '<img src="gifs/loading-gcs.gif" alt=""><span>Excluindo item...</span>'
        alvo.classList.add('item-em-exclusao')
        alvo.setAttribute('aria-busy', 'true')
        // Em <tr> o overlay vai na primeira célula e se estica sobre a linha (tr é a referência).
        ;(alvo.tagName === 'TR' ? alvo.cells[0] || alvo : alvo).appendChild(overlay)
        return { alvo, overlay }
    })

    const liberar = () => {
        for (const { alvo, overlay } of bloqueios) {
            overlay.remove()
            alvo.classList.remove('item-em-exclusao')
            alvo.removeAttribute('aria-busy')
        }
    }
    setTimeout(liberar, LIMITE_BLOQUEIO_EXCLUSAO_MS)
    return liberar
}

async function deletar(caminho) {

    const liberarItens = bloquearItensExclusao(caminho)
    const resultado = await deletarNoServidor(caminho)
    // O servidor responde { success: true }; erro vira popup e devolve vazio.
    if (!resultado?.success)
        liberarItens()
    return resultado
}

async function deletarNoServidor(caminho) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const url = `${api}/deletar`

    const objeto = {
        caminho,
        usuario: acesso.usuario
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(objeto)
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        if (data.mensagem)
            return popup({ mensagem: data.mensagem })

        return data

    } catch (erro) {
        popup({ mensagem: `Erro ao tentar deletar '${caminho}': ${erro.message || erro}` })
        removerOverlay()
        return null
    }
}

async function enviar(caminho, info) {

    await sincronizarRelogioServidor()

    const url = `${api}/salvar`
    const objeto = { caminho, valor: info }
    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(objeto)
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            // Erro ao tentar interpretar como JSON;
            console.error("Resposta não é JSON válido:", parseError);
            return null;
        }

        if (!response.ok) {
            // Se a API respondeu erro (ex: 400, 500);
            console.error("Erro HTTP:", response.status, data)
            return { mensagem: data?.mensagem || 'Falha ao salvar: Fale com o suporte.' }
        }

        return data;
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        return null;
    }
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


async function contagemStatus() {

    const url = `${read}/contagem-status`
    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
        }
    })

    let data

    try {
        data = await response.json()
    } catch (parseError) {
        console.error("Resposta não é JSON válido:", parseError)
        return null
    }

    if (!response.ok) {
        console.error("Erro HTTP:", response.status, data)
        return { mensagem: data?.mensagem || 'Falha ao salvar: Fale com o suporte.' }
    }

    return data

}

async function dadosIniciais() {

    const url = `${read}/dados-iniciais`
    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
        }
    })

    let data

    try {
        data = await response.json()
    } catch (parseError) {
        console.error("Resposta não é JSON válido:", parseError)
        return null
    }

    if (!response.ok) {
        console.error("Erro HTTP:", response.status, data)
        return { mensagem: data?.mensagem || 'Falha ao salvar: Fale com o suporte.' }
    }

    return data

}
