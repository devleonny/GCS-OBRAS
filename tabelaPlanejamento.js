  let dados_orcamentos = {}

  async function acompanharOrcamento() {
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    let acumulado = `
    <div>
        <label>Buscar Orçamento</label>
        <textarea oninput="sugestoes(this)"></textarea>
    </div>`
    openPopup_v2(acumulado, 'PLANEJAMENTO LOJAS')
}

async function sugestoes(input) {

    let pesquisa = String(input.value).toLowerCase()
    let opcoes = '';

    for([idOrcamento, orcamento] of  Object.entries(dados_orcamentos)) {
        let chamado = orcamento.dados_orcam.contrato
        if(String(chamado).toLowerCase().includes(pesquisa)) {
        opcoes += `
        <div class="autocomplete-item" style="font-size: 0.8vw;" onclick="">
            <label>${chamado}</label>
        </div>
        `
        }
    }
   


    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    let posicao = input.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div = `
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `

    if (opcoes == '') {
        return
    }

    document.body.insertAdjacentHTML('beforeend', div)
}


async function carregarInformacoes() {
    const obterDados = await recuperarDados('dados_planejamento') || {};
    let acumulado = '';
    let cabecalhos = ['Chamado', 'Loja', 'Analista', 'Status', 'Escopo', 'P. Serviço', 'P.Venda', 'Soma dos Pedidos', 'Valor do Orçamento', 'Soma das Notas de Envio', 'Pendências Carrefour', 'Pendências Hope', 'Início', 'Entrega', 'RF + OS'];
    let thSearch = '';
    let tabelaPlanejamento = document.getElementById('tabelaPlanejamento');
    let linhas = ''
    let toolbar = ''

    cabecalhos.forEach((cabecalho, i) => (
        thHead += `
        <th>${cabecalho}</th>`,

        thSearch += `
        <th style="bakcground-color: white">
            <div style="display: flex; justify-content: space-between; align-items: center"
        </th>`
    ))
}


async function definir_campo(input_id, omie_departamento, descricao) {

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    if (input_id == '' || omie_departamento == '') {
        return
    }

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
    let dia_tecnico = input_id.split('_')
    let omie_tecnico = dia_tecnico[1]
    let dia = dia_tecnico[0]
    let ano = document.getElementById('ano').value
    let mes = document.getElementById('mes').value

    let tecnico = dados_agenda_tecnicos?.[omie_tecnico] || {}
    let chave_da_agenda = `${ano}_${meses[mes]}`

    if (!tecnico.agendas) {
        tecnico.agendas = {}
    }

    if (!tecnico.agendas[chave_da_agenda]) {
        tecnico.agendas[chave_da_agenda] = {}
    }

    if (!tecnico.agendas[chave_da_agenda][dia]) {
        tecnico.agendas[chave_da_agenda][dia] = {}
    }

    if (tecnico.agendas[chave_da_agenda][dia]?.departamento == omie_departamento) {
        return
    }

    let dados = {
        departamento: omie_departamento,
        usuario: acesso.usuario,
        data: dt()
    }

    let input = document.getElementById(input_id)
    input.parentElement.id = omie_departamento // ID da td é o cod_departamento; 
    input.previousElementSibling.style.display = omie_departamento != '' ? 'block' : 'none'
    input.value = descricao
    input.nextElementSibling.textContent = acesso.usuario
    input.nextElementSibling.nextElementSibling.textContent = dt()

    colorir_tabela()

    tecnico.agendas[chave_da_agenda][dia] = dados
    await enviar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${chave_da_agenda}/${dia}`, dados)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}