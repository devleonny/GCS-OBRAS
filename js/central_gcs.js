const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>`

const modelo = (valor1, valor2) => `
    <div class="modelo">
        <label>${valor1}</label>
        <div style="width: 100%; text-align: left;">${valor2}</div>
    </div>`

const labelDestaque = (valor1, valor2) => {

    if (!valor2)
        return ''

    return `
    <div style="${vertical}">
        <div><strong>${valor1}:</strong></div>
        <div style="text-align: left; white-space: pre-wrap;">${valor2}</div>
    </div>`
}

const botao = (valor1, funcao, cor) => `
        <div class="contorno-botoes" style="background-color: ${cor}e3; border: solid 1px ${cor};" onclick="${funcao}">
            <label style="white-space: nowrap;">${valor1}</label>
        </div>`

const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>`

const balaoPDF = ({ nf, tipo, codOmie, app }) => {
    return `
    <div class="balaoNF" onclick="abrirDANFE('${codOmie}', '${tipo}', '${app}')">
        <div class="balao1">
            <label>${nf}</label>
            <label><b>${tipo}</b></label>
        </div>
        <div class="balao2">
            PDF
        </div>
    </div>`
}

const modeloBotoes = (imagem, nome, funcao) => {

    if (!imagem.includes('/'))
        imagem = `imagens/${imagem}.png`

    return `
    <div class="atalhos" style="width: 100%;" onclick="${funcao}">
        <img src="${imagem}">
        <label style="cursor: pointer;">${nome}</label>
    </div>
    `
}

const layoutBotao = (nome, funcao, img) => `
    <div onclick="${funcao}" class="botoesRodape">
        <img src="imagens/${img}.png" style="cursor: pointer; width: 2vw;">
        <label>${nome}</label>
    </div>
`

async function executar(nomeFuncao) {
    if (!nomeFuncao) return

    let nome = nomeFuncao
    let params = []

    if (nomeFuncao.includes('(')) {
        const match = nomeFuncao.match(/^([^(]+)\((.*)\)$/)

        if (match) {
            nome = match[1].trim()

            const conteudo = match[2].trim()
            if (conteudo) {
                params = Function(`return [${conteudo}]`)()
            }
        }
    }

    if (nome.includes('tela'))
        funcaoTela = nomeFuncao

    funcaoAtiva = nomeFuncao

    if (typeof window[nome] === 'function') {
        return await window[nome](...params)
    } else {
        popup({ mensagem: `<b>Função não encontrada:</b> ${nomeFuncao}` })
    }
}

async function telaInicialGCS() {

    priExeGCS = false

    atribuirVariaveis()

    criarMenus('inicial')

    cUsuario.style.display = 'none'
    toolbar.style.display = 'flex'
    titulo.textContent = 'GCS'

    const planoFundo = `
        <div class="planoFundo">
            <img src="gifs/loading.gif" style="width: 5rem;">
        </div>`

    const tInterna = `
        <div class="telaInterna">
            ${planoFundo}
        </div>`

    tela.innerHTML = tInterna

    await carregarControles()
    await criarElementosIniciais()
    await auxPendencias()

    if (!LPUS)
        await recuperarLPUS()

}

async function recuperarLPUS() {
    const resposta = await buscarLPUs()

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    if (resposta.lpus)
        LPUS = resposta.lpus
}

async function salvarDepartamento({ img, nome }) {

    overlayAguarde()

    const input = img ? img.previousElementSibling : null
    nome = nome || input.value || null

    if (!nome)
        return popup({ mensagem: 'Nome em branco' })

    const resposta = await criarDepartamento(nome)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    if (input) {
        input.value = ''
        img.style.display = 'none'
    }

    popup({ imagem: 'imagens/concluido.png', mensagem: 'Salvo com successo' })
}

async function respostaSincronizacao(script) {

    let localResposta = document.getElementById('localResposta')

    localResposta.innerHTML = `<img src="gifs/loading.gif" style="width: 5rem;">`

    const resposta = await sincronizar(script)

    localResposta.innerHTML = resposta.mensagem || 'Sem resposta'

}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function mudarStatus(id, select) {

    const st = select.value

    await enviar(`clientes/${id}/status`, st)

    if (st == 'Invisível')
        enviar(`clientes/${id}/status_arquivado`, st)

}

function balaoUsuario(st, texto) {

    if (document.title == 'PDF') return

    let msg = document.querySelector('.popup-mensagem')
    if (msg) msg.remove()

    const mensagemPop = `
        <div class="popup-mensagem">
            <img src="imagens/${st}.png">
            <span>${st}</span>
            <span>${texto}</span>
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', mensagemPop)

    msg = document.querySelector('.popup-mensagem')

    requestAnimationFrame(() => {
        msg.style.opacity = '1'
        msg.style.transform = 'translateY(0)'
    })

    setTimeout(() => {
        msg.style.opacity = '0'
        msg.style.transform = 'translateY(20px)'
        setTimeout(() => msg.remove(), 400)
    }, 5000)
}

async function usuariosToolbar() {

    if (!acesso)
        return

    acesso = JSON.parse(localStorage.getItem('acesso')) || null

    const uOnline = await contarPorCampo({ base: 'clientes', path: 'status' })

    const { status } = await recuperarDado('clientes', acesso?.id) || {}

    const indicadorStatus = status || 'offline'

    const usuariosToolbarString = `
        <div class="botaoUsuarios">
            <img name="imgStatus" onclick="painelUsuarios()" src="imagens/${indicadorStatus}.png">
            <label style="font-size: 1.2rem;">${uOnline?.online || 0}</label>
        </div>`

    if (nomeUsuario)
        nomeUsuario.innerHTML = `<span><b>${inicialMaiuscula(acesso?.permissao || '')}</b> ${acesso.usuario || ''}</span>`

    const divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios)
        divUsuarios.innerHTML = usuariosToolbarString

}

async function carregarXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.async = true;

        script.onload = () => {
            const checkInitialization = () => {
                if (typeof XLSX !== 'undefined' && typeof XLSX.utils !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        };

        script.onerror = () => {
            reject(new Error("Falha ao carregar a biblioteca XLSX"));
        }

        document.head.appendChild(script);
    });
}

async function irPdf(id) {

    window.open(`pdf.html?id=${id}`, '_blank')

}

function filtrarAAZ(coluna, id) {

    let el = document.getElementById(id)
    let tbody = el.tagName === "TBODY" ? el : el.tBodies[0]
    if (!tbody) return

    let linhas = Array.from(tbody.rows)
    let ascendente = (el.dataset.order ?? "desc") !== "asc"

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna] || '')
        let valorB = capturarValorCelula(b.cells[coluna] || '')

        // Normaliza números com "R$", vírgula etc.
        const parseValor = v => {
            if (typeof v !== 'string') return v
            return parseFloat(
                v.replace(/[^\d,-]/g, '')
                    .replace(',', '.')
            )
        }

        const numA = parseValor(valorA)
        const numB = parseValor(valorB)

        if (!isNaN(numA) && !isNaN(numB)) {
            return ascendente ? numA - numB : numB - numA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    })

    linhas.forEach(linha => tbody.appendChild(linha))
    el.dataset.order = ascendente ? "asc" : "desc"
}

function capturarValorCelula(celula) {
    if (!celula) return ''

    let entrada =
        celula.querySelector('input') ||
        celula.querySelector('textarea') ||
        celula.querySelector('select')

    if (entrada) return entrada.value.toLowerCase()

    return celula.textContent.toLowerCase()
}

async function painelUsuarios() {

    const colunas = {
        'Status': { chave: 'status' },
        'Usuários': { chave: 'usuario' },
        'Permissão': { chave: 'permissao' },
        'Setor': { chave: 'setor' }
    }

    const pag = 'usuariosOnline'
    const tOnline = await modTab({
        pag,
        colunas,
        body: 'bodyUsuariosOnline',
        base: 'clientes',
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        criarLinha: 'criarLinhaPainelUsuarios',
        ordenar: {
            path: 'status',
            direcao: 'desc'
        }
    })

    const elemento = `
        <div class="conteinerOnline">

            ${tOnline}

        </div>`

    const divOnline = document.querySelector('.divOnline')
    if (divOnline)
        return

    popup({ elemento, titulo: 'Painel de Usuários', })

    await paginacao(pag)
}

function criarLinhaPainelUsuarios(dados) {

    const {
        id,
        usuario,
        status,
        setor,
        permissao
    } = dados || {}

    let gerenciarStatus = `<label>${status || 'offline'}</label>`

    if (usuario == acesso.usuario) {

        const statusOpcoes = ['online', 'Em almoço', 'Não perturbe', 'Em reunião', 'Apenas Whatsapp']
        if (acesso?.permissao == 'adm')
            statusOpcoes.push('Invisível')

        gerenciarStatus = `
            <select class="opcoesSelect" onchange="mudarStatus(${id}, this)">
                ${statusOpcoes.map(op => `<option ${status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>`
    }

    return `
    <tr>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 0.5rem;">
                <img src="imagens/${status || 'offline'}.png" style="width: 1.5rem;">
                ${gerenciarStatus}
            </div>
        </td>
        <td>
            ${usuario}
        </td>
        <td>
            ${permissao || ''}
        </td>
        <td>
            ${setor || ''}
        </td>
    </tr>`
}

async function gerarPdfOnline(htmlString, nome) {

    const encoded = new TextEncoder().encode(htmlString)
    const compressed = pako.gzip(encoded)

    try {

        const response = await fetch(`${api}/pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: compressed
        })

        const contentType = response.headers.get("content-type") || ""

        if (contentType.includes("application/json")) {

            const erro = await response.json()
            popup({ mensagem: erro.mensagem || 'Falha ao gerar o PDF' })
            return

        }

        const blob = await response.blob()

        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${nome}.pdf`
        link.click()

    } catch (err) {

        popup({ mensagem: err.message || 'Falha ao gerar o PDF' })

    }
}

async function reprocessarAnexos(idPagamento) {
    overlayAguarde()
    return new Promise((resolve, reject) => {

        fetch(`${api}/reprocessar_anexos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idPagamento })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)
                }
                return response.text()
            })
            .then(data => {
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                resolve(data)
            })
            .catch(err => {
                console.log(err)
                popup({ mensagem: 'Finalizado', imagem: 'imagens/concluido.png' })
                reject(err)
            })
    })
}

function sincronizar(script) {
    return new Promise((resolve, reject) => {

        fetch(`${api}/sincronizar`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script })
        })
            .then(response => response.text())
            .then(data => {
                resolve(JSON.parse(data))
            })
            .catch(error => {
                reject(error)
            });

    })
}

async function verAprovacoes() {

    if (telaAtiva.includes('criarOrcamento'))
        return popup({ mensagem: 'Não é possível ver aprovações enquanto um orçamento é editado' })

    const pag = 'aprovacao'

    const tabela = await modTab({
        colunas: {
            'Contrato': { chave: 'snapshots.contrato' },
            'Cliente': { chave: 'snapshots.cliente' },
            'Total Original <br>[s/desc ou acres]': {},
            'Total Geral': { chave: 'snapshots.valor' },
            '%': '',
            'Localização': { chave: 'snapshots.cidade' },
            'Usuário': { chave: 'snapshots.responsavel' },
            'Aprovação': { chave: 'aprovacao.status', tipoPesquisa: 'select' },
            'Comentário': { chave: 'aprovacao.justificativa' },
            'Detalhes': ''
        },
        pag,
        base: 'dados_orcamentos',
        pag: 'aprovacao',
        criarLinha: 'criarLinhaAprovacao',
        body: 'tAprovacao',
        filtros: {
            'aprovacao': { op: 'NOT_EMPTY' },
            'aprovacao.status': { op: '=', value: 'pendente' },
        }
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            ${tabela}

        </div>
    `
    popup({ elemento, titulo: 'Aprovações de Orçamento' })

    await paginacao(pag)

}

async function criarLinhaAprovacao(orcamento) {

    const { dados_orcam = {}, snapshots = {} } = orcamento || {}
    const idOrcamento = orcamento.id
    const aprovacao = orcamento.aprovacao
    const status = aprovacao?.status || 'desconhecido'
    const porcentagemDiferenca = (((orcamento.total_geral - orcamento.total_bruto) / orcamento.total_bruto) * 100).toFixed(2)
    const campos = [dados_orcam?.chamado, dados_orcam?.contrato, dados_orcam?.data]
        .filter(c => c)
        .join('<br>')

    return `
        <tr>
            <td style="text-align: left;">
                ${campos}
            </td>
            <td style="text-align: left;">${(snapshots?.cliente || '').toUpperCase()}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_bruto)}</td>
            <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
            <td><label class="labelAprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label></td>
            <td>${(snapshots?.cidade || '').toUpperCase()}</td>
            <td>${aprovacao?.usuario || '--'}</td>
            <td>
                <div style="display: flex; align-items: center; justify-content: start; gap: 1vw;">
                    <img src="imagens/${status}.png">
                    <label>${status}</label>
                </div>
            </td>
            <td>${aprovacao?.justificativa || '--'}</td>
            <td>
                <img src="imagens/pesquisar2.png" onclick="verPedidoAprovacao('${idOrcamento}')">
            </td>
        </tr>
        `

}

async function verificarPendencias() {

    if (!navigator.onLine)
        return

    const contador = await contarPorCampo({
        base: 'dados_orcamentos',
        path: 'aprovacao.status'
    })

    const contadorPendencias = document.getElementById('contadorPendencias')
    if (!contadorPendencias)
        return

    contadorPendencias.style.display = contador.pendente > 0 ? 'flex' : 'none'
    contadorPendencias.textContent = contador.pendente

}

async function verPedidoAprovacao(idOrcamento) {

    overlayAguarde()

    const permissao = acesso.permissao
    const pessoasPermitidas = ['adm', 'diretoria']

    if (!pessoasPermitidas.includes(permissao))
        return popup({ mensagem: 'Você não tem acesso' })

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const { cidade, cliente } = orcamento?.snapshots || {}
    const lpu = orcamento.lpu_ativa
        ? String(orcamento.lpu_ativa).toLowerCase()
        : null

    const pag = 'criarOrcamento'
    const tabela = await modTab({
        base: Object.values(orcamento.esquema_composicoes || orcamento.dados_composicoes || {}),
        pag,
        nude: true,
        scroll: false,
        editavel: false,
        funcaoAdicional: ['formatarLinhasOrcamento', 'calcularSubtotais'],
        body: 'bodyOrcamento',
        criarLinha: 'carregarLinhaOrcamento',
        colunas: {}
    })

    const divOrganizada = (valor, termo) => {
        return `
            <div style="${vertical}; width: 100%; margin-bottom: 5px;">
                <label style="text-align: left;"><b>${termo}</b></label>
                <label style="text-align: left;"><small>${valor}</small></label>
            </div>
            `
    }

    const totalBruto = orcamento?.total_bruto
    const totalGeral = conversor(orcamento.total_geral)
    const diferencaDinheiro = totalGeral - totalBruto
    const diferencaPorcentagem = `${(diferencaDinheiro / totalBruto * 100).toFixed(2)}%`

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; gap: 5px;">
                
                <div style="${horizontal}; gap: 2rem;">
                    <div style="${vertical}">
                        ${divOrganizada(orcamento?.dados_orcam?.analista || '--', 'Solicitante')}
                        ${divOrganizada(cliente || '?', 'Cliente')}
                        ${divOrganizada(cidade || '?', 'Localidade')}
                    </div>
                    <div style="${vertical}">
                        ${divOrganizada(dinheiro(totalGeral), 'Total Geral')}
                        ${divOrganizada(dinheiro(totalBruto), 'Total Original (sem Acréscimo e/ou Desconto)')}
                        ${divOrganizada(`<label class="labelAprovacao" style="background-color: ${diferencaDinheiro > 0 ? 'green' : '#B12425'}">${dinheiro(diferencaDinheiro)}</label>`, 'Diferença em Dinheiro')}
                        ${divOrganizada(diferencaPorcentagem, 'Percentual')}
                    </div>
                </div>

                <div style="${horizontal} gap: 5px;" onclick="visibilidadeOrcamento(this)">
                    <img src="imagens/olhoFechado.png">
                    <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                </div>

                <div style="${horizontal}; display: none;">
                    ${tabela}
                </div>

            </div>`
        }
    ]

    const botoes = [
        { texto: 'Aprovar', img: 'concluido', funcao: `respostaAprovacao('${idOrcamento}', 'aprovado')` },
        { texto: 'Reprovar', img: 'cancel', funcao: `respostaAprovacao('${idOrcamento}', 'reprovado')` },
    ]

    popup({ linhas, botoes, titulo: 'Detalhes' })

    await paginacao(pag)

}

function visibilidadeOrcamento(div) {
    let img = div.querySelector('img')
    let label = div.querySelector('label')
    let divTabelas = div.nextElementSibling
    let display = divTabelas.style.display

    if (display == 'none') {
        divTabelas.style.display = 'flex'
        img.src = 'imagens/olhoAberto.png'
        label.textContent = 'Ocultar itens'
    } else {
        divTabelas.style.display = 'none'
        img.src = 'imagens/olhoFechado.png'
        label.textContent = 'Ver itens do Orçamento'
    }
}

async function respostaAprovacao(idOrcamento, status) {

    overlayAguarde()

    const dados = {
        usuario: acesso.usuario,
        data: new Date().toLocaleString(),
        status
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    orcamento.aprovacao = {
        ...orcamento.aprovacao,
        ...dados
    }

    await enviar(`dados_orcamentos/${idOrcamento}/aprovacao`, orcamento.aprovacao)

    removerPopup()

    verificarPendencias()

}

function painelEdicao(tela) {

    const listaORCS = Object.entries(JSON.parse(localStorage.getItem('temporario')) || {})
        .map(([idEdicao, orc]) => {

            const { lpu_ativa, origem } = orc || {}

            const vinculado = origem
                ? `<span class="tag-cliente">Vinculado • ${origem.idOcorrencia}</span>`
                : ''

            const div = `
                <tr>
                    <td>
                        <button onclick="editarOrcamentoTemporario('${idEdicao}', '${lpu_ativa}')">Editar</button>
                    </td>
                    <td>
                        <div style="${vertical}; gap: 2px;">
                            <span class="tag-cliente">${orc?.dados_orcam?.contrato || 'Novo Orçamento'}</span>
                            ${vinculado}
                        </div>
                    </td>
                    <td>${dinheiro(orc?.total_geral || 0)}</td>
                    <td>${lpu_ativa || 'LPU HOPE'}</td>
                    <td>${new Date(orc?.timestamp || Date.now()).toLocaleString()}</td>
                    <td><img src="imagens/cancel.png" onclick="removerOrcTemp(this, '${idEdicao}')"></td>
                </tr>
                `

            return div
        })

    const novo = crypto.randomUUID()

    // Se não existir orcs em edição, pode passar adiante;
    if (!listaORCS.length)
        return editarOrcamentoTemporario(novo, tela == 1 ? 'ALUGUEL' : null)

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <span style="text-align: left;">
                <b>SEUS ORÇAMENTOS EM EDIÇÃO TEMPORÁRIA</b><br>
                Escolha um orçamento para voltar a editar ou clique para começar um novo.

                <br>
                <br>

                <b>ATENÇÃO</b><br>
                Se você excluir algo aqui será removida apenas a versão temporária no seu computador,<br>
                a versão final do orçamento continuará salva no servidor.
            </span>

            <br>

            <button onclick="editarOrcamentoTemporario('${novo}')">Novo Orçamento</button>
            <button onclick="editarOrcamentoTemporario('${novo}', 'ALUGUEL')">Novo Orçamento de Aluguel</button>

            <br>

            <div class="borda-tabela">

                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            ${['', 'nº ORÇAMENTO', 'Total', 'LPU', 'Última alteração', 'Excluir'].map(op => `<th>${op}</th>`).join('')} 
                        </thead>
                        <tbody>${listaORCS.join('')}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `

    popup({ elemento, titulo: 'Orçamentos em Edição' })

}

async function removerOrcTemp(img, idEdicao) {

    img.closest('tr').remove()

    const temporario = JSON.parse(localStorage.getItem('temporario')) || {}

    delete temporario[idEdicao]

    localStorage.setItem('temporario', JSON.stringify(temporario))

}

async function editarOrcamentoTemporario(idEdicao, lpu) {

    removerPopup()

    sessionStorage.setItem('idEdicao', idEdicao)
    tela.innerHTML = ''

    if (lpu == 'ALUGUEL')
        await telaCriarOrcamentoAluguel()
    else
        await telaCriarOrcamento()

}

function baseOrcamento(orcamento, remover = false) {

    const temporario = JSON.parse(localStorage.getItem('temporario')) || {}
    const idEdicao = sessionStorage.getItem('idEdicao')

    // remover
    if (remover) {
        delete temporario[idEdicao]
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // salvar
    if (orcamento) {
        temporario[idEdicao] = orcamento
        localStorage.setItem('temporario', JSON.stringify(temporario))
        return
    }

    // ler
    return temporario[idEdicao] || null
}

async function painelClientes(idOrcamento = null) {

    overlayAguarde()

    // Salvamento do id para uso na função 'Dados do cliente';
    const idOrcParaTag = idOrcamento || 'novo'
    controles.etiquetas ??= {}
    controles.etiquetas.idOrcamento = idOrcParaTag

    const orcamento = idOrcamento
        ? await recuperarDado('dados_orcamentos', idOrcamento) || {}
        : baseOrcamento()

    const { usuarios, dados_orcam, snapshots } = orcamento || {}
    const {
        venda_direta,
        contrato,
        executor,
        tecnico,
        tipo_de_frete,
        transportadora,
        consideracoes,
        validade,
        garantia,
        emissor,
        analista,
        email_analista,
        telefone_analista,
        omie_cliente,
        condicoes
    } = dados_orcam || {}

    const bloq = orcamento?.hierarquia
        ? true
        : false

    const [cliente, clienteVendaDireta] = await Promise.all([
        recuperarDado('clientes', omie_cliente),
        recuperarDado('clientes', venda_direta)
    ])

    const levantamentos = Object.entries(orcamento?.levantamentos || {})
        .map(([idAnexo, anexo]) =>
            criarAnexoVisual(
                anexo.nome,
                anexo.link,
                idOrcamento
                    ? `excluirLevantamentoStatus('${idAnexo}', '${idOrcamento}')`
                    : `excluirLevantamentoStatus('${idAnexo}')`))
        .join('')


    const botoes = [
        {
            texto: 'Salvar Dados',
            img: 'concluido',
            funcao: idOrcamento
                ? `salvarDadosCliente('${idOrcamento}')`
                : 'salvarDadosCliente()'
        }
    ]

    // cxOpcoes -> Cliente
    controlesCxOpcoes.cliente = {
        retornar: ['nome'],
        base: 'clientes',
        filtros: {
            'app': { op: '=', value: 'AC' }
        },
        funcaoAdicional: ['buscarDadosCliente'],
        colunas: {

            'Nome Fantasia': { chave: 'nome' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' },
            'CNPJ/CPF': { chave: 'cnpj' }
        }
    }

    // cxOpcoes -> Venda Direta
    controlesCxOpcoes.venda_direta = {
        retornar: ['nome'],
        base: 'clientes',
        filtros: {
            'app': { op: '=', value: 'AC' }
        },
        colunas: {
            'Nome Fantasia': { chave: 'nome' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' },
            'CNPJ/CPF': { chave: 'cnpj' }
        }
    }

    const oTransportadoras = transportadoras
        .map(o => `<option ${transportadora == o ? 'selected' : ''}>${o}</option>`)
        .join('')

    const {
        nome,
        ddd,
        celular,
        email
    } = acesso || {}

    const linhas = [
        {
            texto: 'Contrato',
            elemento: `<input value="${contrato || 'ORC ...'}" readOnly>`
        },
        {
            texto: 'Cliente',
            elemento: `
            <div style="${horizontal}; gap: 3px">
                ${bloq
                    ? `<img src="imagens/proibido.png">` : ''}
                <span ${omie_cliente
                    ? `id="${omie_cliente}"`
                    : ''} 
                    class="opcoes" 
                    name="cliente" 
                    ${bloq ? '' : `onclick="cxOpcoes('cliente')"`}>
                        ${cliente?.nome || 'Selecione'}
                </span>
                ${bloq ? '' : `<img onclick="formularioCliente()" src="imagens/baixar.png">`}
            </div>
            ` },
        {
            texto: 'CNPJ/CPF',
            elemento: `<span id="cnpj">${cliente?.cnpj || ''}</span>`
        },
        {
            texto: 'Endereço',
            elemento: `<span id="endereco">${cliente?.endereco || ''}</span>`
        },
        {
            texto: 'Bairro',
            elemento: `<span id="bairro">${cliente?.bairro || ''}</span>`
        },
        {
            texto: 'CEP', elemento: `<span id="cep">${cliente?.cep || ''}</span>`
        },
        {
            texto: 'Cidade',
            elemento: `<span id="cidade">${cliente?.cidade || ''}</span>`
        },
        {
            texto: 'Estado',
            elemento: `<span id="estado">${cliente?.estado || ''}</span>`
        },
        {
            texto: `
                <div style="${horizontal}; gap: 1rem;">
                    <input ${venda_direta ? 'checked' : ''} onclick="toggleVendaDireta()" type="checkbox" style="width: 2rem; height: 2rem;">
                    <span>Venda Direta</span>
                </div>
            `,
            elemento: `<span 
                data-ativo="${venda_direta ? 'S' : 'N'}"
                ${venda_direta ? `id="${venda_direta}"` : ''}
                style="display: ${venda_direta ? 'block' : 'none'}"
                class="opcoes"
                onclick="cxOpcoes('venda_direta')" 
                name="venda_direta">${clienteVendaDireta?.nome || 'Selecionar'}</span>`
        },
        {
            texto: 'Condições de Pagamento',
            elemento: `
            <select id="condicoes">
                ${parcelas.map(op => `<option ${condicoes == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            `
        },
        {
            texto: 'Tipo de Frete',
            elemento: `
            <select id="tipo_de_frete">
                ${['', 'CIF', 'FOB'].map(op => `<option ${tipo_de_frete == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            `
        },
        {
            texto: 'Transportadora',
            elemento: `
                <select class="pedido" id="transportadora">
                    ${oTransportadoras}
                </select>
                `
        },
        {
            texto: 'Escopo',
            elemento: `<textarea id="consideracoes" style="text-transform: uppercase;">${consideracoes || 'ESCOPO: '}</textarea>`
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'executores')">
                <span>Executores / Delegar</span>
            </div>
            `,
            elemento: '<div class="executores"></div>'
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'tecnicos')">
                <span>Técnicos</span>
            </div>
            `,
            elemento: '<div class="tecnicos"></div>'
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/etiqueta.png" onclick="renderPainel('${idOrcParaTag}')">
                <span>Tags</span>
            </div>
            `,
            elemento: `<div id="tags" style="${vertical}; gap: 2px;"></div>`
        },
        {
            texto: 'Validade da Proposta',
            elemento: `<div style="${horizontal}; gap: 3px;"><input id="validade" style="width: 3rem;" type="number" value="${validade || 30}"> <span>dias</span></div>`
        },
        {
            texto: 'Garantia',
            elemento: `<textarea id="garantia">${garantia || 'Conforme tratativa Comercial'}</textarea>`
        },
        {
            texto: 'Analista',
            elemento: `<input id="analista" value="${analista || nome || ''}">`
        },
        {
            texto: 'E-mail',
            elemento: `<textarea id="email_analista">${email_analista || email || ''}</textarea>`
        },
        {
            texto: 'Celular',
            elemento: `<input id="telefone_analista" value="${telefone_analista || `${ddd || ''} ${celular || ''}` }">`
        },
        {
            texto: 'Empresa',
            elemento: `
                <select id="emissor">
                    ${['AC SOLUÇÕES', 'IAC', 'HNW', 'HNK'].map(op => `<option ${emissor == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
        }
    ]

    const formExistente = document.querySelector('#emissor')
    if (formExistente)
        return removerOverlay()

    popup({ linhas, botoes, titulo: 'Dados do Cliente', autoDestruicao: ['cliente', 'tecnico'] })

    await maisUsuario(executor, 'executores')
    await maisUsuario(tecnico, 'tecnicos')
    carregarTags()

}

function toggleVendaDireta() {

    const checkVD = document.querySelector('[name="venda_direta"]')

    const statusAtivo = checkVD?.dataset?.ativo == 'S'

    checkVD.style.display = statusAtivo
        ? 'none'
        : 'block'

    checkVD.dataset.ativo = statusAtivo
        ? 'N'
        : 'S'

}

async function carregarTags() {

    const id = controles.etiquetas.idOrcamento
    const localTags = document.getElementById('tags')

    localTags.innerHTML = '<img src="gifs/loading.gif" style="width: 5rem;">'

    const { snapshots } = id !== 'novo'
        ? await recuperarDado('dados_orcamentos', id) || {}
        : baseOrcamento()

    // Tags;
    const listaTags = Object.values(snapshots?.tags || {})
        .map(tag => modeloTag(tag, id))
        .join('')

    localTags.innerHTML = listaTags

}

async function buscarDadosCliente() {
    const clienteName = document.querySelector('[name="cliente"]')
    if (!clienteName) return

    const omie_cliente = Number(clienteName.id)
    const cliente = await recuperarDado('clientes', omie_cliente) || {}

    const campos = ['cnpj', 'endereco', 'bairro', 'cidade', 'estado', 'cep']
    for (const campo of campos) {
        const el = document.getElementById(campo)
        if (el) el.textContent = cliente?.[campo] || ''
    }

    const idOrcamento = controles.etiquetas.idOrcamento
    const isNovo = idOrcamento === 'novo'
    const orcamento = isNovo
        ? baseOrcamento()
        : await recuperarDado('dados_orcamentos', idOrcamento) || {}

    orcamento.tags ||= {}

    if (isNovo) {
        orcamento.snapshots ||= {}
        orcamento.snapshots.tags ||= {}
    }

    for (const idTag in orcamento.tags) {
        if (orcamento.tags[idTag]?.auto === 'S') {
            delete orcamento.tags[idTag]
        }
    }

    if (isNovo) {
        for (const idTag in orcamento.snapshots.tags) {
            if (orcamento.snapshots.tags[idTag]?.auto === 'S') {
                delete orcamento.snapshots.tags[idTag]
            }
        }
    }

    const empresa = cliente?.snapshots?.empresa

    if (empresa) {
        const pesquisa = await pesquisarDB({
            base: 'tags_orcamentos',
            filtros: {
                nome: { op: '=', value: empresa }
            }
        })

        const tagEmpresa = pesquisa.resultados[0] || null

        if (tagEmpresa) {
            orcamento.tags[tagEmpresa.id] = {
                data: new Date().toLocaleDateString(),
                usuario: acesso.usuario,
                auto: 'S'
            }

            if (isNovo) {
                orcamento.snapshots.tags[tagEmpresa.id] = {
                    auto: 'S',
                    ...tagEmpresa
                }
            }
        }
    }

    if (isNovo) {
        baseOrcamento(orcamento)
    } else {
        await enviar(`dados_orcamentos/${idOrcamento}/tags`, orcamento.tags)
    }

    carregarTags()
}

async function salvarDadosCliente(idOrcamento) {

    overlayAguarde()

    try {

        const orcamentoBase = idOrcamento
            ? await recuperarDado('dados_orcamentos', idOrcamento)
            : baseOrcamento() || {}

        const el = (id) => {
            const elemento = document.getElementById(id)
            return elemento || null
        }

        orcamentoBase.dados_orcam ??= {}

        const omie_cliente = Number(document.querySelector('[name="cliente"]').id)

        // Venda Direta;
        const spanVendaDireta = document.querySelector('[name="venda_direta"]')
        const venda_direta = spanVendaDireta.dataset.ativo == 'S'
            ? document.querySelector('[name="venda_direta"]')?.id || null
            : null

        // Executores;
        const executor = [...document.querySelectorAll('.executores span')]
            .filter(span => span.id)
            .map(span => span.id)

        // Técnicos;
        const tecnico = [...document.querySelectorAll('.tecnicos span')]
            .filter(span => span.id)
            .map(span => span.id)

        if (tecnico.length == 0 && ['LPU PEÇAS', 'LPU FERRAMENTAS'].includes(orcamentoBase.lpu_ativa))
            return popup({ mensagem: 'LPU PEÇAS & FERRAMENTAS > O campo técnico não fica em branco!' })

        orcamentoBase.dados_orcam = {
            ...orcamentoBase.dados_orcam,
            omie_cliente,
            venda_direta,
            condicoes: el('condicoes').value,
            consideracoes: String(el('consideracoes').value).toUpperCase(),
            data: new Date().toLocaleString('pt-BR'),
            garantia: el('garantia').value,
            validade: Number(el('validade').value),
            transportadora: el('transportadora').value,
            tipo_de_frete: el('tipo_de_frete').value,
            emissor: el('emissor').value,
            email_analista: el('email_analista').value,
            analista: el('analista').value,
            telefone_analista: el('telefone_analista').value,
            executor,
            tecnico
        }

        // Se não existir a chave contrato; sequencial fará que o servidor crie;
        orcamentoBase.dados_orcam.contrato ??= 'sequencial'

        if (idOrcamento) {

            // Tags são salvar em tempo real;

            await enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamentoBase.dados_orcam)
            await abrirAtalhos(idOrcamento)

        } else {

            // Tags estão dentro do objeto, serão salvas junto do orçamento;

            baseOrcamento(orcamentoBase)
        }

        removerPopup()

    } catch (erro) {

        popup({ mensagem: erro.mensage || 'Falha ao salvar os dados' })

    }

}

async function abrirDANFE(codOmieNF) {

    overlayAguarde()

    const { link, mensagem } = await buscarDANFE(codOmieNF)

    if (mensagem)
        return popup({ mensagem })

    removerOverlay()

    try {
        shell.openExternal(link)
    } catch {
        window.open(link, '_blank')
    }
}

async function buscarDANFE(codOmieNF) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/danfe`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
        },

        body: JSON.stringify({ codOmieNF })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()

}

async function criarDepartamento(nome) {
    try {

        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

        const response = await fetch(`${api}/criar-departamento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ numOrc: nome })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (err) {
        return { mensagem: err.mensage || 'Falha na criação do departamento' }
    }
}

async function numORC(idOrcamento) {
    try {
        const response = await fetch(`${api}/prox-num-orc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idOrcamento })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}