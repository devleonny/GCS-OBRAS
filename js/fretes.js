


async function telaFretes() {

    overlayAguarde()

    const pag = 'fretes'
    const tabela = await modTab({
        pag,
        base: 'vw_fretes',
        body: 'vw_fretes',
        criarLinha: 'criarLinhafretes',
        colunas: {
            'Método de Envio': {},
            'Rastreio': {},
            'Volume': {},
            'Valor da Nota': {},
            'Custo Frete': {},
            'Loja': {},
            'Orçamentos': {},
            'Tipo': {},
            'UF': {},
            'Nota Fiscal': {},
            'Data de Saída': {},
            'Data de Entrega': {},
            'Material': {},
            'Situação': {},
            'Comentário': {}
        }
    })

    tela.innerHTML =  `
        <div>
            <div class="toolbar">
                
            </div>
            ${tabela}
        </div>
    `

    await paginacao(pag)

    removerOverlay()

}


function criarLinhafretes(dados) {

    const {
        metodo_envio,
        rastreio,
        volumes,
        total,
        custo_frete,
        cliente,
        departamento,
        categoria,
        estado,
        n_nota,
        data_saida,
        data_entrega,
        itens,
        situacao,
        comentario
    } = dados || {}

    return `
        <tr>
            <td>${metodo_envio || ''}</td>
            <td>${rastreio || ''}</td>
            <td>
                <span class="etiquetas">${volumes || 0}</span>
            </td>
            <td>
                <span>${dinheiro(total)}</span>
            </td>
            <td>
                <span>${dinheiro(custo_frete)}</span>
            </td>
            <td>${cliente || ''}</td>
            <td>
                <div style="display: flex; flex-wrap; wrap;">${departamento || ''}</div>
            </td>
            <td>${categoria || ''}</td>
            <td>${estado || ''}</td>
            <td>${n_nota || ''}</td>
            <td>${data_saida || ''}</td>
            <td>${data_entrega || ''}</td>
            <td>
                <button>Ver itens</button>
            </td>
            <td>${situacao || ''}</td>
            <td>
                <div style="display: flex; flex-wrap; wrap;">${comentario || ''}</div>
            </td>
        </tr>
    `


}


async function envioMaterial(id = crypto.randomUUID()) {

    const {
        transportadora,
        rastreio,
        previsao,
        custo_frete,
        data_saida,
        volumes,
        nf,
        comentario
    } = await recuperarDado('materiais', id) || {}

    const oTransportadoras = transportadoras
        .map(o => `<option ${transportadora == o ? 'selected' : ''}>${o}</option>`)
        .join('')

    const linhas = [
        {
            texto: 'Número de rastreio',
            elemento: `<input class="pedido" id="rastreio" value="${rastreio || ''}">`
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
            texto: 'Custo do Frete',
            elemento: `<input  type="number" id="custo_frete" value="${custo_frete || ''}">`
        },
        {
            texto: 'Nota Fiscal',
            elemento: `<input id="nf" value="${nf || ''}">`
        },
        {
            texto: 'Comentário',
            elemento: `<textarea id="comentario">${comentario || ''}</textarea>`
        },
        {
            texto: 'Quantos volumes',
            elemento: `<input  type="number" id="volumes" value="${volumes || ''}">`
        },
        {
            texto: 'Data de Saída',
            elemento: `<input type="date" id="data_saida" value="${data_saida || ''}">`
        },
        {
            texto: 'Data de Entrega',
            elemento: `<input type="date" id="previsao" value="${previsao || ''}">`
        },
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `registrarEnvioMaterial('${id}')"` }
    ]

    popup({ linhas, botoes, titulo: 'Envio de Material' })
}

async function registrarEnvioMaterial(id) {

    overlayAguarde()

    const campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario', 'volumes', 'data_saida', 'previsao']

    const material = await recuperarDado('materiais', id) || {}
    const departamento = controles?.ocorrencias?.ativo
    const dadosCampos = campos.reduce((acc, campo) => {
        const info = document.getElementById(campo)
        if (!info)
            return acc

        let valor = info.value

        if (info.type === 'number') {
            valor = Number(valor)
        }

        acc[campo] = valor
        return acc
    }, {})

    const dados = {
        ...material,
        departamento,
        data: new Date().toLocaleString(),
        ...dadosCampos
    }

    await enviar(`materiais/${id}`, dados)

    removerPopup()

}