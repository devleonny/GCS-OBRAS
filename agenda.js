let filtro_tecnicos = {}
let clientesOmie = {}
const arredonda2 = n => Math.round(n * 100) / 100

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

let regioes = ['Nordeste', 'Norte', 'Sudeste', 'Sul', 'Centro-Oeste', 'Sem Região', 'Clientes Novos', 'Administrativo']

iniciar_agendas()

async function iniciar_agendas(alterar) {
    await carregar_tabela(alterar)
    filtrar_por_regiao()
}

async function sincronizar_departamentos() {

    overlayAguarde()

    await sincronizar('departamentos')
    let dados_departamentos = await receber('dados_departamentos')
    await inserirDados(dados_departamentos, 'dados_departamentos')

    remover_popup()
    return dados_departamentos
}

async function recuperar_agenda() {
    await sincronizarDados('dados_agenda_tecnicos')
    await carregar_tabela()
}

async function carregar_tabela(alterar) {

    overlayAguarde()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos')
    let dados_clientes = await recuperarDados('dados_clientes')
    let clientes_invertidos = {}

    let dados_departamentos = await recuperarDados('dados_departamentos') || {}
    if (Object.keys(dados_departamentos) == 0) {
        dados_departamentos = await sincronizar_departamentos()
    }

    for (id in dados_clientes) {
        let cliente = dados_clientes[id]
        clientes_invertidos[cliente.omie] = cliente
    }

    if (!dados_agenda_tecnicos || Object.keys(dados_agenda_tecnicos).length == 0) {
        recuperar_agenda()
    }

    // Salvar quando alterado os dois Selects;
    if (alterar) {
        let mes = document.getElementById('mes')
        let ano = document.getElementById('ano')
        let periodoAtual = {
            mes: mes.value,
            ano: ano.value
        }
        localStorage.setItem('periodoAtual', JSON.stringify(periodoAtual))
    }
    // Salvar quando alterado os dois Selects;

    let dataAtual = new Date()
    let mesesIndiceMes = Object.entries(meses)
    periodoAtual = JSON.parse(localStorage.getItem('periodoAtual')) || { mes: mesesIndiceMes[dataAtual.getMonth()][0], ano: dataAtual.getFullYear() }

    let selectAno = periodoAtual.ano
    let selecMes = periodoAtual.mes
    let stringMeses = ''

    for (mes in meses) {
        stringMeses += `
            <option ${mes === selecMes ? 'selected' : ''}>${mes}</option>
        `
    }

    let linhas = ''
    let dias = new Date(selectAno, meses[selecMes] + 1, 0).getDate() // Último dia do mês, simples...
    let ths = `
        <th>Técnicos</th>
        <th>Região</th>
        <th>Config</th>
    `
    for (let i = 1; i <= dias; i++) { // Cabeçalho dias/Semanas do mês
        let data = new Date(selectAno, meses[selecMes], i)

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
        let periodo = `${selectAno}_${meses[selecMes]}`

        if (tecnico.agendas && tecnico.agendas[periodo]) {
            agenda = tecnico.agendas[periodo]
        }

        for (let i = 1; i <= dias; i++) { // tds, células da agenda de cada técnico;
            let cod_departamento = agenda?.[i]?.departamento || ''
            let info = dados_departamentos?.[cod_departamento]?.descricao || cod_departamento

            celulas_dias += `
                <td id="${cod_departamento}" style="cursor: move; position: relative;">
                    <div style="display: ${info != '' ? 'block' : 'none'}" class="com-triangulo" onclick="apagar_dia('${i}_${omie_tecnico}', this)"></div>
                    <input id="${i}_${omie_tecnico}" style="cursor: default; width: 3vw; background-color: transparent;" onmouseout="nome_em_destaque(this, false)" onmouseover="nome_em_destaque(this, true)" oninput="sugestoes(this)" value="${info}">
                    <label style="display: none;">${agenda?.[i]?.usuario || ''}</label>
                    <label style="display: none;">${agenda?.[i]?.data || ''}</label>
                </td>
            `
        }

        // Coluna 1: Nome do técnico;
        // Coluna 2: Região;
        // Coluna 3: Cofig;

        let regiao = dados_agenda_tecnicos[omie_tecnico]?.regiao_atual || 'Sem Região'

        linhas += `
        <tr>
            <td id="${omie_tecnico}">
                <label style="font-size: 0.7vw;">${clientes_invertidos[omie_tecnico]?.nome || omie_tecnico}</label>
            </td>
            <td>
                <label style="font-size: 0.7vw;">${regiao}</label>
            </td>
            <td style="text-align: center;">
                <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrir_detalhes('${omie_tecnico}')">
            </td>
            ${celulas_dias}
        </tr>
        `
    }

    let string_regioes = ''
    regioes.forEach(regiao => {
        string_regioes += `
        <div style="display: flex; align-items: center; justify-content: left; gap: 2px;">
            <input style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox" onchange="incluir_regiao(this)">
            <label style="font-size: 0.8vw;">${regiao}</label>
        </div>
        `
    })

    let tabela = `
        <div class="fundo_tabela" id="dados_agenda">
            <table id="tabelaAgenda" class="tabela" style="table-layout: fixed;">
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

        <div style="color: white; display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 1vw; width: 17vw;">

            <label>Mês</label>
            <select id="mes" onchange="iniciar_agendas(true)">
                ${stringMeses}
            </select>

            <hr style="width: 100%;">

            <label>Ano</label>
            <select id="ano" onchange="iniciar_agendas(true)">
                <option ${selectAno == 2025 ? 'selected' : ''}>2025</option>
                <option ${selectAno == 2026 ? 'selected' : ''}>2026</option>
            </select>

            <hr style="width: 100%;">

            <label>Nome</label>
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 2px;">
                <input class="campos" oninput="filtrar_por_regiao()" id="campo_tecnico_pesquisa" placeholder="Pesquisar">
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

    arrastarCelulas()

    colorir_tabela()

    remover_popup()

    filtrar_tabela('0', 'tabelaAgenda') // Script genérico que organiza a tabela com base na coluna e no ID da tabela.
}

async function apagar_dia(diaOmieTecnico) {

    let [dia, omie_tecnico] = diaOmieTecnico.split('_')
    let div = document.getElementById(diaOmieTecnico).previousElementSibling

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value

    let ano_mes = `${ano}_${meses[mes]}`
    let tecnico = dados_agenda_tecnicos[omie_tecnico]

    delete tecnico?.agendas[ano_mes]?.[dia]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${ano_mes}/${dia}`)

    let td = div.parentElement
    td.style.backgroundColor = 'white'
    td.querySelector('input').style.color = 'black' // Input dentro da td
    div.style.display = 'none'
    div.nextElementSibling.value = ''

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

}

async function confirmar_apagar_agenda(omie_tecnico) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_invertido = {}
    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        dados_clientes_invertido[cliente.omie] = cliente
    }

    openPopup_v2(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Apagar a agenda deste mês para este técnico?</label>
            <label>${dados_clientes_invertido?.[omie_tecnico]?.nome || omie_tecnico}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_agenda('${omie_tecnico}')">Confirmar</button>
        </div>
        `, 'Aviso')

}

async function apagar_agenda(omie_tecnico) {

    remover_popup()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let mes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value

    let ano_mes = `${ano}_${meses[mes]}`
    let tecnico = dados_agenda_tecnicos[omie_tecnico]

    delete tecnico?.agendas[ano_mes]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}/agendas/${ano_mes}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    carregar_tabela()

}

async function abrir_opcoes() {

    let acumulado = `
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Escolha o Funcionário:</label>
            <textarea id="textarea_tecnico" oninput="sugestoes(this, true)"></textarea>
            <div></div>
        </div>
    `
    openPopup_v2(acumulado, 'Novo Funcionário')
}

async function sugestoes(input, tecnicos) {

    let pesquisa = String(input.value).toLowerCase()
    let opcoes = ''

    if (!tecnicos) {
        let dados_departamentos = await recuperarDados('dados_departamentos') || {}

        for (omie in dados_departamentos) {
            let item = dados_departamentos[omie]
            let descricao = item.descricao.toLowerCase()
            if (descricao.includes(pesquisa)) {
                opcoes += `
                <div onclick="definir_campo('${input.id}', '${omie}', '${item.descricao}')" class="autocomplete-item" style="font-size: 0.8vw;">${item.descricao}</div>`
            }
        }

    } else { // No caso de ser as sugestões para novo técnico

        let dados_clientes = await recuperarDados('dados_clientes') || {}

        for (cnpj in dados_clientes) {
            let cliente = dados_clientes[cnpj]
            if (String(cliente.nome).toLowerCase().includes(pesquisa)) {
                opcoes += `
                <div class="autocomplete-item" style="font-size: 0.8vw;" onclick="escolher_tecnico('${cliente.omie}', '${cliente.nome}')">${cliente.nome}</div>
                `
            }
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
    if (pesquisa == '') { // O usuário apagou o campo, então limpa na agenda...

        if (tecnicos) {
            document.getElementById('textarea_tecnico').nextElementSibling.innerHTML = ''
        } else {
            await definir_campo(input.id, '', '')
        }

        return

    }

    if (opcoes == '') {
        return
    }

    document.body.insertAdjacentHTML('beforeend', div)
}

async function escolher_tecnico(omie_tecnico, nome_tecnico) {

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }
    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    // Caso seja apenas a tela de Lançamento;
    let telaLancamento = document.getElementById('telaLancamento')
    let textarea = document.getElementById('textarea_tecnico')
    textarea.value = nome_tecnico

    if (telaLancamento) {
        textarea.previousElementSibling.value = omie_tecnico
        return
    }

    if (dados_agenda_tecnicos[omie_tecnico]) {
        openPopup_v2(`
            <div style="margin: 10px;">
                <label>Técnico já existente na base!</label>
            </div>
            `
            , 'Aviso', true)
        return

    } else {

        textarea.nextElementSibling.innerHTML = `
            <button style="background-color: #4CAF50;" onclick="salvar_tecnico('${omie_tecnico}')">Confirmar</button>
        `
    }

}

async function salvar_tecnico(omie_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    dados_agenda_tecnicos[omie_tecnico] = {
        omie: omie_tecnico,
        regiao_atual: 'Sem Região',
        agendas: {}
    }

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    enviar(`dados_agenda_tecnicos/${omie_tecnico}`, dados_agenda_tecnicos[omie_tecnico])

    remover_popup()

    await carregar_tabela()

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

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

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

async function filtrar_por_regiao() {

    let campo_tecnico_pesquisa = String(document.getElementById('campo_tecnico_pesquisa').value).toLowerCase();
    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {};
    let tabela = document.querySelector('table');
    let tbody = tabela.querySelector('tbody');
    let trs = tbody.querySelectorAll('tr');

    let filtros_regioes = document.getElementById('filtros_regioes');
    let inputs = filtros_regioes.querySelectorAll('input');
    let regioes_ativas = JSON.parse(localStorage.getItem('regioes_ativas')) || [];

    inputs.forEach(input => {
        let regiao = input.nextElementSibling.textContent;
        input.checked = regioes_ativas.includes(regiao);
    });

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td');
        let codigo_tecnico = tds[0].id;
        let regiao_do_tecnico = dados_agenda_tecnicos?.[codigo_tecnico]?.regiao_atual || '';
        let nome_tecnico = String(tds[0].querySelector('label').textContent).toLowerCase();

        let mostrar_linha =
            (regioes_ativas.length === 0 || regioes_ativas.includes(regiao_do_tecnico)) &&
            (campo_tecnico_pesquisa === '' || nome_tecnico.includes(campo_tecnico_pesquisa));

        tr.style.display = mostrar_linha ? 'table-row' : 'none';
    });
}

async function incluir_regiao(input) {
    let regiao = input.nextElementSibling.textContent;
    let regioes_ativas = JSON.parse(localStorage.getItem('regioes_ativas')) || [];

    if (input.checked) {
        if (!regioes_ativas.includes(regiao)) {
            regioes_ativas.push(regiao);
        }
    } else {
        let posicao = regioes_ativas.indexOf(regiao);
        if (posicao !== -1) {
            regioes_ativas.splice(posicao, 1);
        }
    }

    localStorage.setItem('regioes_ativas', JSON.stringify(regioes_ativas));
    await filtrar_por_regiao();
}

async function abrir_detalhes(codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    let atual = tecnico.regiao_atual
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let opcoes = `
        <option></option>
    `

    regioes.forEach(regiao => {
        opcoes += `
        <option  ${atual == regiao ? 'selected' : ''}>${regiao}</option>
        `
    })

    let acumulado = `
    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; margin: 2vw; gap: 2vh;">
        <label>Região atual do ${clientesOmie?.[codigo_tecnico]?.nome || codigo_tecnico}</label>
        <select onchange="alterar_regiao(this, ${codigo_tecnico})" class="select_regiao">
            ${opcoes}
        </select>
    </div>
    <hr>
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Apagar essa agenda?</label>
        <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_agenda('${codigo_tecnico}')">
    </div>

    ${acesso.permissao == 'adm' ?
            `<hr>
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <label>Apagar o técnico?</label>
        <img src="imagens/excluir.png" style="cursor: pointer; width: 2vw;" onclick="confirmar_apagar_tecnico('${codigo_tecnico}')">
    </div>
    ` : ''}

    
    
    
    `

    openPopup_v2(acumulado, 'Configurações')

}

async function confirmar_apagar_tecnico(omie_tecnico) {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_invertido = {}
    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        dados_clientes_invertido[cliente.omie] = cliente
    }

    openPopup_v2(`
        <div style="margin: 10px; gap: 10px; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <label>Apagar este técnico?</label>
            <label>${dados_clientes_invertido?.[omie_tecnico]?.nome || omie_tecnico}</label>
            <button style="background-color: #4CAF50;" onclick="apagar_tecnico('${omie_tecnico}')">Confirmar</button>
        </div>
        `, 'Aviso')

}

async function apagar_tecnico(omie_tecnico) {

    remover_popup()

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}

    delete dados_agenda_tecnicos[omie_tecnico]

    deletar(`dados_agenda_tecnicos/${omie_tecnico}`)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    carregar_tabela()

}

async function alterar_regiao(select, codigo_tecnico) {

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let tecnico = dados_agenda_tecnicos[codigo_tecnico]
    tecnico.regiao_atual = select.value

    enviar(`dados_agenda_tecnicos/${codigo_tecnico}/regiao_atual`, select.value)

    await inserirDados(dados_agenda_tecnicos, 'dados_agenda_tecnicos')

    await carregar_tabela()
    filtrar_por_regiao()

}

function colorir_tabela() {

    let departamentos = JSON.parse(localStorage.getItem('cores_departamentos')) || {}
    let tabela = document.querySelector('table')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')

        tds.forEach((td, i) => {

            if (i > 2) {

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
                    td.style.backgroundColor = ''
                    td.style.color = 'black'
                }

            }
        })

    })

    localStorage.setItem('cores_departamentos', JSON.stringify(departamentos))

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

        let usuario = elemento.nextElementSibling
        let data = usuario.nextElementSibling
        let posicao = elemento.getBoundingClientRect()
        let left = posicao.left + window.scrollX
        let top = posicao.bottom + window.scrollY

        let acumulado = `
            <div id="etiqueta" style="top: ${top}px; left: ${left}px; display: flex; align-items: start; justify-content: start; gap: 5px; flex-direction: column;">
                <label>${elemento.value}</label>
                <label>${usuario.textContent}</label>
                <label>${data.textContent}</label>
            </div>
        `
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

}

let relatorios = {
    tecnico: {},
    departamentos: { total: 0 }
}

async function painelDistruibuicao() {

    let permitidos = ['adm', 'fin']
    let setores = ['RH', 'FINANCEIRO']

    if(!permitidos.includes(acesso.permissao) && !setores.includes(acesso.setor)) {
        let mensagem = `
            <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Apenas setores RH, ADM e FINANCEIRO estão liberados para este painel</label>
            </div>
        `
       return openPopup_v2(mensagem, 'Aviso')
    }

    let dados_agenda_tecnicos = await recuperarDados('dados_agenda_tecnicos') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    clientesOmie = {}
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
    let dados_categorias = await recuperarDados('dados_categorias') || {}

    for ([cnpj, cliente] of Object.entries(dados_clientes)) {
        clientesOmie[cliente.omie] = cliente
    }

    let selectMes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value
    let mes = meses[selectMes]

    // Recuperar pagamentos deste mês;
    let divsPagamentos = ''
    for ([idPagamento, pagamento] of Object.entries(lista_pagamentos)) {

        if (pagamento.departamento == 'AGENDA' && pagamento.mes == mes && pagamento.ano == ano) {

            let param = pagamento.param[0]
            let categoria = dados_categorias[pagamento.param[0].categorias[0].codigo_categoria]
            let valor = param.valor_documento
            let observacao = param.observacao
            let dataVencimento = param.data_vencimento
            let clienteFornecedor = clientesOmie?.[param.codigo_cliente_fornecedor]?.nome || 'Desatualizado...'
            let status = pagamento.status

            divsPagamentos += `
            <div style="display: flex; justify-content: left; align-items: center; width: 100%;">
                <div class="blocoPagamentoPai" onclick="incluirLancamento('${idPagamento}')">
                    <div class="blocoPagamento">
                        <div>
                            <label><strong>Categoria</strong></label>
                            <label>${categoria}</label>
                        </div>
                        <div>
                            <label><strong>Vencimento</strong></label>
                            <label>${dataVencimento}</label>
                        </div>
                        <div>
                            <label><strong>Valor</strong></label>
                            <label>${dinheiro(valor)}</label>
                        </div>
                    </div>

                    <div class="blocoPagamento">
                        <div>
                            <label><strong>Observação</strong></label>
                            <label style="text-align: left; padding: 5px;">${observacao}</label>
                        </div>
                        <div>
                            <label><strong>Cliente / Fornecedor</strong></label>
                            <label style="text-align: left; padding: 5px;">${clienteFornecedor}</label>
                        </div>
                        <div>
                            <label><strong>Status</strong></label>
                            <label style="text-align: left; padding: 5px;">${status}</label>
                        </div>                        
                    </div>
                </div>

                <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer; padding: 5px;" onclick="confirmarExclusao('${idPagamento}')">
            </div>
            `
        }
    }

    relatorios = {
        tecnico: {},
        departamentos: { total: 0 }
    }

    for (let [id, tecnico] of Object.entries(dados_agenda_tecnicos)) {

        let agendas = tecnico.agendas || {}
        let omieTecnico = tecnico.omie
        let agendaAtual = `${ano}_${mes}`

        if (!relatorios.tecnico[omieTecnico]) {
            relatorios.tecnico[omieTecnico] = {}
        }

        let relatorio = relatorios.tecnico[omieTecnico]

        if (agendas[agendaAtual]) {

            if (!relatorio.departamentos) {
                relatorio.departamentos = { total: 0 }
            }
            let departamentos = relatorio.departamentos

            for (dia in agendas[agendaAtual]) {

                let departamento = agendas[agendaAtual][dia].departamento

                if (!departamentos[departamento]) {
                    departamentos[departamento] = 0
                }

                if (!relatorios.departamentos[departamento]) {
                    relatorios.departamentos[departamento] = 0
                }


                relatorios.departamentos[departamento]++ // Acrescenta 1 para o técnico em seu próprio relatório;
                departamentos.total++ // Aqui é o total geral no relatório do técnico;

                departamentos[departamento]++ // Acrescenta 1 para a loja para o relátorio geral;
                relatorios.departamentos.total++ // Acrescenta 1 para a loja para o relatório de departamentos;
            }
        }
    }

    if (divsPagamentos == '') {
        divsPagamentos = `
            <div class="blocoPagamentoPai">
                <div class="blocoPagamento">
                    <div>
                        <label>Sem pagamentos lançados</label>
                    </div>
                </div>
            </div>
        `
    }

    let acumulado = `

        <div style="background-color: #d2d2d2; display: flex; justify-content: start; align-items: start; gap: 1vw; width: 70vw; padding: 5px;">
            <div style="width: 50%; display: flex; align-items: center; justify-content: start; flex-direction: column;">
                <label>Distribuição por Departamento</label>
                <hr style="width: 100%;">
                ${await gerarTabelas('departamentos', false)}
            </div>

            <div style="width: 50%;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                    <label>Lançamentos</label>
                    <div class="contorno_botoes" style="background-color: #097fe6" onclick="incluirLancamento()">
                        <label>Novo <strong>Lançamento</strong></label>
                    </div>
                </div>
                <br>
                <div class="painelPagamentos">
                    ${divsPagamentos}
                </div>

            </div>
        </div>
        `

    openPopup_v2(acumulado, 'Painel de Distribuição')

}

async function confirmarExclusao(idPagamento) {

    let mensagem = `
        <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Deseja realmente excluir?</label>
        </div>
        <button onclick="excluirPagamento('${idPagamento}')">Confirmar</button>
    
    `
    openPopup_v2(mensagem, 'Aviso', true)
}

async function excluirPagamento(idPagamento) {

    overlayAguarde()

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    delete lista_pagamentos[idPagamento]

    await inserirDados(lista_pagamentos, 'lista_pagamentos')

    remover_popup()
    await painelDistruibuicao()

}

async function gerarTabelas(tipo, editavel, distribuicao) {

    let dados_departamentos = await recuperarDados('dados_departamentos') || {}
    let relatorioDepartamento = distribuicao ? distribuicao : relatorios[tipo]

    if (!relatorioDepartamento) return '<label>Erro</label>'

    let linhas = ''
    let totalPorcentagem = 0
    let totalDepartamentos = relatorioDepartamento.total

    for ([omie, departamento] of Object.entries(relatorioDepartamento)) {

        if (omie == 'total') continue

        let porcentagem = departamento / totalDepartamentos
        let labelPorcentagem = `${((porcentagem * 100)).toFixed(2)}%`
        totalPorcentagem += (porcentagem * 100)
        let nome = dados_departamentos[omie]?.descricao || omie
        linhas += ` 
            <tr>
                <td>${nome}</td>
                <td style="text-align: center;">${departamento}</td>
                <td style="text-align: center;">${labelPorcentagem}</td>
                ${editavel ? `<td id="${omie}"><label>R$ 0,00</label> <input style="display: none;" type="number" value="${porcentagem}"></td>` : ''}
            </tr>
        `
    }

    linhas += `
            <tr>
                <td colspan="2" style="text-align: center;">${totalPorcentagem.toFixed(0)}%</td>
                ${editavel ? `<td colspan="2" style="text-align: center;">R$ 0,00</td>` : '<td></td>'}
            </tr>
        `

    let tabela =
        `<table class="tabela" style="width: 100%;">
            <thead>
                <th>Departamento</th>
                <th>Dias</th>
                <th>% Distribuição</th>
                ${editavel ? `<th>R$ Distribuição</th>` : ''}
            </thead>
            <tbody ${editavel ? `id="tbody"` : ''}>
                ${linhas}
            </tbody>
        </table>`

    return tabela
}

function calcularDistribuicao(localizacao) {
    let tbody = document.getElementById(localizacao)

    if (localizacao.tagName === 'INPUT') {
        tbody = localizacao.parentElement.parentElement.parentElement // INPUT > TD > TR > TBODY
    }

    let valorTotal = Number(document.getElementById('valorTotal').value)

    if (tbody) {
        let trs = Array.from(tbody.querySelectorAll('tr'))
        let total = {
            porcentagem: 0,
            dinheiro: 0
        }

        let linhasValidas = trs.filter(tr => tr.querySelectorAll('td').length > 2)
        let ultimaLinha = linhasValidas[linhasValidas.length - 1]

        linhasValidas.forEach(tr => {
            let tds = tr.querySelectorAll('td')
            let input = tds[3].querySelector('input')
            let label = tds[3].querySelector('label')

            let porcentagem = Number(input.value)

            let valor
            if (tr === ultimaLinha) {
                valor = arredonda2(valorTotal - total.dinheiro)
            } else {
                valor = arredonda2(valorTotal * porcentagem)
            }

            label.textContent = dinheiro(valor)

            total.porcentagem += porcentagem
            total.dinheiro += valor
        })

        let trTotal = trs.find(tr => tr.querySelectorAll('td').length <= 2)
        if (trTotal) {
            let tds = trTotal.querySelectorAll('td')
            tds[0].textContent = `${(total.porcentagem * 100).toFixed(0)}%`
            tds[1].textContent = dinheiro(total.dinheiro)
        }
    }
}

function dataInput(data) {
    let splitData = data.split('/')
    data = new Date(splitData[2], Number(splitData[1]) - 1, splitData[0])
    let ano = data.getFullYear()
    let mes = String(data.getMonth() + 1).padStart(2, '0')
    let dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
}

async function incluirLancamento(idPagamento) {

    let dados_categorias = await recuperarDados('dados_categorias') || {}
    let pagamento = { param: [{}] }

    if (idPagamento) {
        let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}
        pagamento = lista_pagamentos[idPagamento]
    }

    let param = pagamento.param[0]

    let categoriasOrdenadas = Object.entries(dados_categorias).sort((a, b) => {
        return a[1].localeCompare(b[1])
    })

    let opcoes = `<option></option>` // Primeira opção em branco

    for (let [idCategoria, nomeCategoria] of categoriasOrdenadas) {
        opcoes += `<option value="${idCategoria}" ${param?.categorias?.[0]?.codigo_categoria == idCategoria ? 'selected' : ''}>${nomeCategoria}</option>`
    }

    let dataVencimento = ''

    if (param.data_vencimento) {
        dataVencimento = dataInput(param.data_vencimento)
    }

    let acumulado = `
    <div id="telaLancamento" style="max-height: 80%; overflow: auto; padding: 5px; width: 30vw; background-color: #d2d2d2; border-radius: 3px; display: flex; justify-content: center; align-items: start; flex-direction: column;">

        <label>Cliente / Fornecedor</label>
        <input style="display: none;" value="${param?.codigo_cliente_fornecedor || ''}">
        <textarea style="width: 95%;" id="textarea_tecnico" oninput="sugestoes(this, true)">${clientesOmie[param?.codigo_cliente_fornecedor]?.nome || ''}</textarea>
        <div></div>

        <hr style="width: 100%;">
        <div style="display: flex; justify-content: start; align-items: center; gap: 1vw;"> 
            <label>Data de Pagamento</label>
            <input id="dataVencimento" type="date" value="${dataVencimento}" style="padding: 5px; border-radius: 3px;">
        </div>

        <hr style="width: 100%;">
        <div style="display: flex; justify-content: start; align-items: center; gap: 1vw;"> 
            <label>Categoria</label>
            <select id="categoria">
                ${opcoes}
            </select>
        </div>

        <hr style="width: 100%;">
        <label>Observação</label>
        <textarea id="observacao" rows="5" style="width: 95%;">${param?.observacao || ''}</textarea>

        <hr style="width: 100%;">
        <div style="display: flex; justify-content: start; align-items: center; gap: 1vw;"> 
            <label>Valor</label>
            <input value="${param?.valor_documento || ''}" oninput="calcularDistribuicao('tbody')" id="valorTotal" type="number" style="width: 10vw; padding: 5px; border-radius: 3px;">
        </div>

        <hr style="width: 100%;">

        <label>Distribuição</label>
        ${await gerarTabelas('departamentos', true)}

        <hr style="width: 100%;">
        <button style="background-color: #097fe6;" onclick="salvarLancamento('${idPagamento}')">Salvar Lançamento</button>

    </div>
    `

    openPopup_v2(acumulado, 'Lançamento', true)

    calcularDistribuicao('tbody')
}


async function salvarLancamento(idPagamento) {

    overlayAguarde()

    let call = idPagamento ? 'AlterarContaPagar' : false
    idPagamento ? idPagamento : unicoID()

    let selectMes = document.getElementById('mes').value
    let ano = document.getElementById('ano').value
    let mes = meses[selectMes]

    let codigoCliente = document.getElementById('textarea_tecnico').previousElementSibling.value
    let valorDocumento = document.getElementById('valorTotal').value
    let observacao = document.getElementById('observacao').value
    let dataVencimento = document.getElementById('dataVencimento').value
    let codigoCategoria = document.getElementById('categoria').value
    let mensagemHTML = (termo) => `
    <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>Verifique o campo <strong>${termo}</strong></label>
    </div>
    `
    let campos = [
        { nome: 'Cliente / Fornecedor', valor: codigoCliente },
        { nome: 'Data de Vencimento', valor: dataVencimento },
        { nome: 'Categoria', valor: codigoCategoria },
        { nome: 'Observação', valor: observacao },
        { nome: 'Valor do Documento', valor: valorDocumento }
    ]

    for (let campo of campos) {
        if (!campo.valor) {
            return openPopup_v2(mensagemHTML(campo.nome), 'Aviso', true)
        }
    }

    codigoCliente = Number(codigoCliente)
    valorDocumento = Number(valorDocumento)

    let [anoInput, mesInput, diaInput] = dataVencimento.split('-')
    dataVencimento = `${diaInput}/${mesInput}/${anoInput}`

    let distribuicao = []

    let tbody = document.getElementById('tbody')
    let trs = tbody.querySelectorAll('tr')

    for (i in trs) {

        if (i == (trs.length - 1)) break // Pular a última linha que é do total

        let tr = trs[i]
        let tds = tr.querySelectorAll('td')
        let cCodDep = Number(tds[3].id)
        let nValDep = conversor(tds[3].querySelector('label').textContent)

        if (isNaN(cCodDep) || isNaN(nValDep)) {
            return openPopup_v2(`Verifique o departamento: ${tds[0].textContent} > ${cCodDep} | ${nValDep}`)
        }

        if (tds.length > 2) {
            distribuicao.push({
                cCodDep,
                nValDep
            })
        }
    }

    let param = [
        {
            "codigo_cliente_fornecedor": codigoCliente,
            "valor_documento": valorDocumento,
            "observacao": observacao,
            "codigo_lancamento_integracao": idPagamento,
            "data_vencimento": dataVencimento,
            "categorias": [{
                codigo_categoria: codigoCategoria,
                valor: valorDocumento
            }],
            "data_previsao": dataVencimento,
            "id_conta_corrente": 6054234828, // Itaú AC
            "distribuicao": distribuicao
        }
    ]

    let pagamento = {
        distribuicao: relatorios.departamentos,
        mes,
        ano,
        status: 'AGENDA',
        id_pagamento: idPagamento,
        id_orcamento: 'AGENDA',
        departamento: 'AGENDA',
        data_registro: data_atual('completa'),
        anexos: {},
        anexos_parceiros: {},
        criado: acesso.usuario,
        param
    }

    let resposta = await lancar_pagamento(pagamento, call)

    console.log(resposta);

    enviar(`lista_pagamentos/${idPagamento}`, pagamento)
    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    lista_pagamentos[idPagamento] = pagamento
    await inserirDados(lista_pagamentos, `lista_pagamentos`)

    remover_popup()
    await painelDistruibuicao()

}

// Arrastar elementos
let tabela;
let isDragging = false
let startCell = null
let startRow, startCol, endRow, endCol

function getCellCoords(cell) {
    const row = cell.parentElement.rowIndex
    const col = cell.cellIndex
    return { row, col }
}

function clearSelection() {
    const sel = tabela.querySelectorAll('.selected')
    sel.forEach(td => td.classList.remove('selected'))
}

function arrastarCelulas() {

    tabela = document.getElementById('tabelaAgenda')

    tabela.addEventListener('mousedown', e => {
        if (e.target.tagName !== 'TD') return

        isDragging = true
        startCell = e.target
        const coords = getCellCoords(startCell)
        startRow = coords.row
        startCol = coords.col

        clearSelection()
        e.target.classList.add('selected')
    })

    tabela.addEventListener('mouseover', e => {
        if (!isDragging || e.target.tagName !== 'TD') return

        clearSelection()
        const coords = getCellCoords(e.target)
        endRow = coords.row
        endCol = coords.col

        let minRow = Math.min(startRow, endRow)
        let maxRow = Math.max(startRow, endRow)
        let minCol = Math.min(startCol, endCol)
        let maxCol = Math.max(startCol, endCol)

        for (let i = minRow; i <= maxRow; i++) {
            for (let j = minCol; j <= maxCol; j++) {
                tabela.rows[i].cells[j].classList.add('selected')
            }
        }
    })

    tabela.addEventListener('mouseup', async () => {
        if (!isDragging) return
        isDragging = false

        const inputStartCell = startCell.querySelector('input')
        const selecionadas = tabela.querySelectorAll('.selected')
        let celulasAtualizacao = {}

        for (cell of selecionadas) {
            let inputCell = cell.querySelector('input')
            let divCell = cell.querySelector('div')

            divCell.style.display = 'block' // Mini triângulo que aparece no canto de cima da td;
            inputCell.value = inputStartCell.value // Texto visível no input, que é o nome do departamento;
            cell.id = startCell.id // ID que representa o departamento, pode flutuar entre as linhas normalmente, mas o ID do input é do técnico, deve ser mantido o original;

            celulasAtualizacao[inputCell.id] = { departamentoOmie: startCell.id, nomeDepartamento: inputStartCell.value }
        }

        for ([diaTecnico, objeto] of Object.entries(celulasAtualizacao)) {

            if (objeto.departamentoOmie == '') {
                await apagar_dia(diaTecnico)
            } else {
                await definir_campo(diaTecnico, objeto.departamentoOmie, objeto.nomeDepartamento)
            }

        }

        colorir_tabela()
        clearSelection()
    })

}