let departamentos = {}
let filtro_tecnicos = {}

let semana = {
    "0": "Dom",
    "1": "Seg",
    "2": "Ter",
    "3": "Qua",
    "4": "Qui",
    "5": "Sex",
    "6": "Sáb"
}

let meses = {
    'Janeiro': 0,
    'Fevereiro': 1,
    'Março': 2,
    'Abril': 3,
    'Maio': 4,
    'Junho': 5,
    'Julho': 6,
    'Agosto': 7,
    'Setembro': 8,
    'Outubro': 9,
    'Novembro': 10,
    'Dezembro': 11
}

let regioes = ['Nordeste', 'Norte', 'Sudeste', 'Sul', 'Centro-Oeste']

carregar_tabela()

async function carregar_tabela() {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
    let dados_clientes = await recuperarDados('dados_clientes')
    let clientes_invertidos = {}

    let dados_departamentos = recuperarDados('dados_departamentos') || {}
    if (Object.keys(dados_departamentos) == 0) {
        dados_departamentos = await receber('dados_departamentos')
        inserirDados(dados_departamentos, 'dados_departamentos')
    }

    for (id in dados_clientes) {
        let cliente = dados_clientes[id]
        clientes_invertidos[cliente.omie] = cliente
    }

    if (!dados_agenda_tecnicos || Object.keys(dados_agenda_tecnicos).length == 0) {
        dados_agenda_tecnicos = await receber('dados_agenda_tecnicos')
        inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')
    }

    let select_ano = document.getElementById('ano')?.value || 2025
    let selec_mes = document.getElementById('mes')?.value || 'Janeiro'
    let linhas = ''
    let dias = new Date(select_ano, meses[selec_mes] + 1, 0).getDate() // Último dia do mês, simples...
    let ths = `
        <th>Técnicos</th>
        <th>Config</th>
    `
    for (let i = 1; i <= dias; i++) {
        let data = new Date(select_ano, meses[selec_mes], i)

        ths += `
        <th>
            <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <label>${i}</label>
                <label>${semana[data.getDay()]}</label>
            </div>
        </th>
        `
    }

    for (omie_tecnico in dados_agenda_tecnicos) {
        let tecnico = dados_agenda_tecnicos[omie_tecnico]
        let celulas_dias = ''
        let agenda = {}
        let periodo = `${select_ano}_${meses[selec_mes]}`

        if (tecnico.agendas && tecnico.agendas[periodo]) {
            agenda = tecnico.agendas[periodo]
        }

        for (let i = 1; i <= dias; i++) {
            let cod_departamento = agenda[i] ? agenda[i] : ''
            let info = dados_departamentos[cod_departamento]?.descricao || cod_departamento

            celulas_dias += `
                <td>
                    <input id="${i}_${omie_tecnico}" style="cursor: pointer; width: 3vw; background-color: transparent;" onmouseover="nome_em_destaque(this, true)" oninput="sugestoes(this)" value="${info}">
                </td>
                `
        }

        linhas += `
        <tr>
            <td id="${omie_tecnico}">
                <label style="font-size: 0.7vw;">${clientes_invertidos[omie_tecnico]?.nome || omie_tecnico}</label>
            </td>
            <td style="text-align: center;">
                <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrir_detalhes('${omie_tecnico}')">
            </td>
            ${celulas_dias}
        </tr>
        `
    }

    let string_meses = ''
    for (mes in meses) {
        string_meses += `
            <option>${mes}</option>
        `
    }

    let string_regioes = ''
    regioes.forEach(regiao => {
        string_regioes += `
        <div style="display: flex; align-items: center; justify-content: left; gap: 1vw;">
            <input style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox" onchange="filtrar_por_regiao()">
            <label style="font-size: 0.8vw;">${regiao}</label>
        </div>
        `
    })

    let tabela = `
        <div class="fundo_tabela" id="dados_agenda">
            <table class="tabela">
                <thead>
                    ${ths}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    let acumulado = `
    <div class="fundo">

        <div style="color: white; display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 1vw; width: 10vw;">
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
                <label>Mês</label>
                <select id="mes" onchange="carregar_tabela()">
                    ${string_meses}
                </select>
            </div>
            <hr style="width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
                <label>Ano</label>
                <select id="ano" onchange="carregar_tabela()">
                    <option>2025</option>
                    <option>2026</option>
                </select>
            </div>
            <hr style="width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
                <label>Técnico</label>
                <input class="campos" oninput="filtrar_por_regiao()" id="campo_tecnico_pesquisa">
            </div>
            <hr style="width: 100%;">
            <label>Regiões</label>
            <div id="filtros_regioes">
                ${string_regioes}
            </div>
        </div>

        ${tabela}

    </div>
    `

    let dados_agenda = document.getElementById('dados_agenda')
    if (dados_agenda) {
        dados_agenda.innerHTML = tabela
    } else {
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

    colorir_tabela()

}

async function sugestoes(input) {

    let pesquisa = String(input.value).toLowerCase()
    let dados_departamentos = await recuperarDados('dados_departamentos') || {}
    let opcoes = ''

    dados_departamentos = { // Opções extras além dos departamentos que chegam da API, inclua aqui... 
        ...dados_departamentos,
        'FERIAS': { codigo: 'FERIAS', descricao: 'FERIAS', omie: 'FERIAS' },
        'FOLGA': { codigo: 'FOLGA', descricao: 'FOLGA', omie: 'FOLGA' },
        'EM CASA': { codigo: 'EM CASA', descricao: 'EM CASA', omie: 'EM CASA' },
        'EM VIAGEM': { codigo: 'EM VIAGEM', descricao: 'EM VIAGEM', omie: 'EM VIAGEM' },
        'ATESTADO': { codigo: 'ATESTADO', descricao: 'ATESTADO', omie: 'ATESTADO' },
        'FERIADO': { codigo: 'FERIADO', descricao: 'FERIADO', omie: 'FERIADO' }
    }

    for (omie in dados_departamentos) {
        let item = dados_departamentos[omie]
        let descricao = item.descricao.toLowerCase()
        if (descricao.includes(pesquisa)) {
            opcoes += `
                <div onclick="definir_campo('${input.id}', '${omie}', '${item.descricao}')" class="autocomplete-item" style="font-size: 0.8vw;">${item.descricao}</div>
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
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; background: white; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `
    if (pesquisa == '') { // O usuário apagou o campo, então limpa na agenda...
        await definir_campo(input.id, '', '')
        return
    }

    if (opcoes == '') {
        return
    }

    document.body.insertAdjacentHTML('beforeend', div)
}

async function definir_campo(input_id, omie_departamento, descricao) {
    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    document.getElementById(input_id).value = descricao

    colorir_tabela()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
    let dia_tecnico = input_id.split('_')
    let omie_tecnico = dia_tecnico[1]

    let dia = dia_tecnico[0]
    let ano = document.getElementById('ano').value
    let mes = document.getElementById('mes').value

    let tecnico = dados_agenda_tecnicos[omie_tecnico]
    let chave_da_agenda = `${ano}_${meses[mes]}`

    if (!tecnico.agendas) {
        tecnico.agendas = {}
    }

    if (!tecnico.agendas[chave_da_agenda]) {
        tecnico.agendas[chave_da_agenda] = {}
    }

    tecnico.agendas[chave_da_agenda][dia] = omie_departamento

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

async function filtrar_por_regiao() {

    let campo_tecnico_pesquisa = String(document.getElementById('campo_tecnico_pesquisa').value).toLowerCase()
    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tabela = document.querySelector('table')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')

    let filtros_regioes = document.getElementById('filtros_regioes')
    let inputs = filtros_regioes.querySelectorAll('input')
    let ativos = []

    inputs.forEach(input => {
        if (input.checked) {
            ativos.push(input.nextElementSibling.textContent)
        }
    })

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')
        let mostrar_linha = false
        let codigo_tecnico = tds[0].id
        let regiao_do_tecnico = dados_agenda_tecnicos?.[codigo_tecnico].regiao_atual || ''

        mostrar_linha = ativos.includes(regiao_do_tecnico)

        ativos.length == 0 ? mostrar_linha = true : ''

        if (campo_tecnico_pesquisa !== '') {
            let nome_tecnico = String(tds[0].querySelector('label').textContent).toLowerCase()
            mostrar_linha = mostrar_linha && nome_tecnico.includes(campo_tecnico_pesquisa)
        }

        mostrar_linha ? tr.style.display = 'table-row' : tr.style.display = 'none'
    })

}

async function abrir_detalhes(codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    let atual = tecnico.regiao_atual

    let acumulado = `

    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; margin: 2vw; gap: 2vh;">
        <label>Região atual do Técnico</label>
        <select onchange="atualizar_regiao(this, ${codigo_tecnico})" class="select_regiao">
            <option ${atual == 'Nordeste' ? 'selected' : ''}>Nordeste</option>
            <option ${atual == 'Norte' ? 'selected' : ''}>Norte</option>
            <option ${atual == 'Centro-Oeste' ? 'selected' : ''}>Centro-Oeste</option>
            <option ${atual == 'Sudeste' ? 'selected' : ''}>Sudeste</option>
            <option ${atual == 'Sul' ? 'selected' : ''}>Sul</option>
        </select>
    </div>
    <hr>
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Apagar essa agenda?</label>
        <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;">
    </div>
    `

    openPopup_v2(acumulado, 'Configurações')

}

async function atualizar_regiao(select, codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    tecnico.regiao_atual = select.value

    inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

function colorir_tabela() {
    let tabela = document.querySelector('table')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')

        tds.forEach((td, i) => {

            if (i != 0 && i != 1) {

                let input = td.querySelector('input')

                if (input.value != '') {

                    if (!departamentos[input.value]) {

                        let estilos = back_fonte()
                        departamentos[input.value] = {
                            bg: estilos.corFundo,
                            cor: estilos.corTexto
                        }
                    }

                    td.style.backgroundColor = departamentos[input.value].bg
                    input.style.color = departamentos[input.value].cor

                } else {
                    td.style.backgroundColor = 'white'
                    td.style.color = 'black'
                }

            }
        })

    })

}

function back_fonte() {
    let corFundo = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    let r = parseInt(corFundo.substring(1, 3), 16);
    let g = parseInt(corFundo.substring(3, 5), 16);
    let b = parseInt(corFundo.substring(5, 7), 16);

    let luminosidade = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let corTexto = luminosidade > 0.5 ? "#000000" : "#FFFFFF";

    return { corFundo, corTexto };
}

function nome_em_destaque(elemento, mostrar) {

    let etiqueta = document.getElementById('etiqueta')
    if (etiqueta) {
        etiqueta.remove()
    }

    if (mostrar && elemento.value !== '') {

        let posicao = elemento.getBoundingClientRect()
        let left = posicao.left + window.scrollX
        let top = posicao.bottom + window.scrollY

        let acumulado = `
            <div id="etiqueta" style="top: ${top}px; left: ${left}px;">
                <label>${elemento.value}</label>
            </div>
        `
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

}