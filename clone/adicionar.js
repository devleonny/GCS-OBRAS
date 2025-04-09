let tabela_atual;
let filtros_produtos = {}

function apagar_orçamento() {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; margin: 2vw;">
            <label>Tem certeza que deseja apagar o Orçamento?</label>
            <button onclick="confirmar_exclusao()" style="background-color: green;">Confirmar</button>
        </div>
        `, 'Atenção')

}

let metaforas = [
    "Um monitor sem imagens para exibir",
    "Um sistema de vigilância sem olhos",
    "Uma rede sem nós conectados",
    "Uma central de segurança em silêncio",
    "Uma câmera sem ângulos para vigiar",
    "Um gravador sem arquivos para armazenar",
    "Um mapa sem áreas para monitorar",
    "Uma sala de controle sem alertas",
    "Um software sem dados para processar",
    "Uma instalação sem cabos para ligar",
    "Um alarme sem disparo",
    "Um servidor sem logs de acesso",
    "Um banco de dados sem registros",
    "Uma cerca virtual sem perímetro",
    "Um sensor sem movimento detectado",
    "Um sistema de monitoramento sem eventos",
    "Uma interface sem transmissões ao vivo",
    "Uma tela de múltiplas câmeras em branco",
    "Um painel de controle sem notificações",
    "Uma infraestrutura sem dispositivos ativos"
]

atualizar_precos()

async function atualizar_precos() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    let modalidade = orcamento_v2.lpu_ativa

    if (modalidade !== 'MODALIDADE LIVRE') {

        let atualizando = document.getElementById('atualizando')
        let penumbra = document.getElementById('penumbra')
        penumbra.style.display = 'none'
        atualizando.style.display = 'flex'
        let menu_superior = document.getElementById('menu_superior')

        menu_superior.style.display = 'none'
        document.getElementById('quieto').innerHTML = `
            <img src="gifs/loading.gif" style="width: 5vw;">
            <label class="novo_titulo">Aguarde...</label>        
        `
        menu_superior.style.display = 'flex'

        await carregar_tabelas()
        await atualizar_lista_de_lpus()

        carregar_datalist_clientes()

        atualizando.style.display = 'none'
        penumbra.style.display = 'block'

    } else {

        carregar_layout_modalidade_livre()

    }

}

document.getElementById('data').textContent = new Date().toLocaleDateString('pt-BR')

function backtop() {

    window.scrollTo(0, 0);

}

function fechar_ir_orcamentos() {

    location.href = 'orcamentos.html'

}

function orcamento_que_deve_voltar() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.id) {
        localStorage.setItem('orcamento_que_deve_voltar', JSON.stringify(orcamento_v2.id))
    }


}

function confirmar_exclusao() {

    localStorage.removeItem('orcamento_v2')
    location.href = 'adicionar.html'
    temp_pop.remove()

}

async function atualizar_lista_de_lpus() {

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    return new Promise((resolve, reject) => {

        var LPUS = [];
        var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
        var lpu = document.getElementById('lpu')

        var LPUS = [
            ...new Set(
                Object.values(dados_composicoes)
                    .flatMap(obj => Object.keys(obj))
                    .filter(key => key.toLowerCase().includes('lpu'))
                    .map(key => key.toUpperCase())
            )
        ];

        var opcoes = ''
        LPUS.forEach(lpu => {
            if (lpu !== 'LPU EQUIPAMENTOS') { // Desativado provisoriamente;
                opcoes += `<option>${lpu}</option>`
            }
        })

        lpu.innerHTML = opcoes

        var select_lpu = document.getElementById('lpu')

        if (orcamento_v2.lpu_ativa) {
            select_lpu.value = orcamento_v2.lpu_ativa
        }

        if (select_lpu.value !== '') {
            orcamento_v2.lpu_ativa = select_lpu.value
            localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        }

        alterar_tabela_lpu()

        resolve()
    })
}

function alterar_tabela_lpu(tabela_lpu) {

    if (tabela_lpu) {
        document.getElementById('lpu').value = tabela_lpu
        var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
        orcamento_v2.lpu_ativa = tabela_lpu
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
    }

    tabela_produtos_v2()
    carregar_tabelas()
}

async function carregar_tabelas() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    if (Object.keys(dados_composicoes).length == 0) {
        await recuperar_dados_composicoes()
    }

    let tabelas = ['serviço', 'venda'];

    tabelas.forEach(tabela => {

        document.getElementById(`linhas_${tabela}`).innerHTML = ''

        let coluna_carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR' ? `<th>Item Original</th>` : '';

        document.getElementById(`thead_${tabela}`).innerHTML = `

            <th>Código</th>${coluna_carrefour}
            <th>Como aparecerá na ${orcamento_v2.lpu_ativa}</th>
            <th>Medida</th>
            <th>Quantidade</th>
            <th>Custo Unitário</th>
            ${orcamento_v2.lpu_ativa !== 'LPU CARREFOUR' ? '<th>Desconto</th>' : ''}
            <th>Valor Total</th>
            <th>Tipo</th>
            <th>Imagem *Ilustrativa</th>
            <th>Remover</th>

        `
    })

    let desconto_geral = document.getElementById('desconto_geral')
    if (orcamento_v2.desconto_geral) {
        desconto_geral.value = orcamento_v2.desconto_geral
    }

    if (orcamento_v2.tipo_de_desconto) {
        desconto_geral.previousElementSibling.value = orcamento_v2.tipo_de_desconto
    }

    if (orcamento_v2.dados_composicoes) {

        let itens = orcamento_v2.dados_composicoes
        for (codigo in itens) {

            await incluir_item(codigo, itens[codigo].qtde)

        }

    }

    total()
}

function removerItem(codigo) {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.dados_composicoes[codigo]) {

        if (orcamento_v2.dados_composicoes[codigo].agrupamentos) {
            alterar_input_tabela(codigo)
        }

        delete orcamento_v2.dados_composicoes[codigo]
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        carregar_tabelas()

    }

}

async function enviar_dados() {
    salvar_preenchido();

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    if (!orcamento_v2.dados_orcam) {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Preencha os dados do Cliente</label>
            </div>
        `);
    }

    let dados_orcam = orcamento_v2.dados_orcam;
    let chamado = dados_orcam.contrato

    if (dados_orcam.cliente_selecionado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Cliente em branco</label>
            </div>
        `);
    }

    if (chamado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado em branco</label>
            </div>
        `);
    }

    let existente = await verificar_chamado_existente(chamado, orcamento_v2.id, false, true)

    if (chamado !== 'sequencial' && existente?.situacao) {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado já Existente</label>
            </div>
        `)
    }

    if (chamado.slice(0, 1) !== 'D' && chamado !== 'sequencial' && chamado.slice(0, 3) !== 'ORC') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado deve começar com D</label>
            </div>
        `);
    }

    if (dados_orcam.estado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Estado em branco</label>
            </div>
        `);
    }

    if (dados_orcam.cnpj === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>CNPJ em branco</label>
            </div>
        `);
    }

    let desconto_porcentagem = document.getElementById('desconto_porcentagem')
    if (desconto_porcentagem && Number(desconto_porcentagem.value) > 0) {
        if (!(orcamento_v2.aprovacao && orcamento_v2.aprovacao.status === 'aprovado')) {
            return autorizar_desconto();
        }
    }

    if (orcamento_v2.dados_composicoes_orcamento || orcamento_v2.dados_composicoes_orcamento === null) {
        delete orcamento_v2.dados_composicoes_orcamento;
    }

    let relancamento = {};
    let converter = false;

    for (let codigo in orcamento_v2.dados_composicoes) {
        let produto = orcamento_v2.dados_composicoes[codigo];
        if (!relancamento[produto.codigo]) {
            relancamento[produto.codigo] = 0;
        }

        relancamento[produto.codigo] += produto.qtde;

        if (produto.agrupamentos) {
            converter = true;
            let agrupamentos = produto.agrupamentos;
            for (let agrup in agrupamentos) {
                if (!relancamento[agrup]) {
                    relancamento[agrup] = 0;
                }

                relancamento[agrup] += agrupamentos[agrup];
            }
        }
    }

    if (converter) {
        if (!orcamento_v2.backup) {
            orcamento_v2.backup = {};
        }
        orcamento_v2.backup = orcamento_v2.dados_composicoes;

        delete orcamento_v2.dados_composicoes;
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
        await carregar_tabelas();

        for (let codigo in relancamento) {
            await incluir_item(codigo, relancamento[codigo]);
        }
    }

    orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')); // Recuperado do localStorage novamente, cuidado com alterações antes disto.
    orcamento_v2.tabela = 'orcamentos';

    if (orcamento_v2.dados_orcam.contrato == 'sequencial') {
        let sequencial = await verificar_chamado_existente(undefined, undefined, true, true)
        orcamento_v2.dados_orcam.contrato = `ORC_${sequencial.proximo}`
    }

    if (!orcamento_v2.id) {
        orcamento_v2.id = 'ORCA_' + unicoID();
    }

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="imagens/concluido.png" style="width: 3vw; height: 3vw;">
            <label>Aguarde... redirecionando...</label>
        </div>
    `)

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_orcamentos[orcamento_v2.id] = orcamento_v2
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${orcamento_v2.id}`, orcamento_v2);

    localStorage.removeItem('orcamento_v2');
    location.href = 'orcamentos.html';

}

async function autorizar_desconto() {
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.aprovacao) {
        orcamento_v2.aprovacao = {}
    }

    orcamento_v2.aprovacao.id = orcamento_v2.aprovacao.id || gerar_id_5_digitos();
    let id = orcamento_v2.aprovacao.id;

    let dados = {
        desconto_porcentagem: document.getElementById('desconto_porcentagem').value,
        total_sem_desconto: document.getElementById('total_sem_desconto').textContent,
        desconto_dinheiro: document.getElementById('desconto_dinheiro').textContent,
        total_geral: document.getElementById('total_geral').textContent
    }

    let mensagem = `
        <img src="gifs/loading.gif" style="width: 5vw;">
        <label>Algum Gerente deve autorizar este desconto... </label>
    `
    if (orcamento_v2.aprovacao.status && orcamento_v2.aprovacao.status == 'reprovado') {
        mensagem = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
            <img src="imagens/cancel.png" style="width: 3vw;">
            <div style="display: flex; align-items: center; justify-content: start; gap: 5px; flex-direction: column;">
                <label>Solicitação reprovada</label>
                <label>${orcamento_v2.aprovacao.justificativa}</label>
            </div>
        </div>
        `
    } else {

        await enviar(`aprovacoes/${id}`, dados)
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
    }

    openPopup_v2(`
            <div id="aguardando_aprovacao" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                ${mensagem}
            </div>
        `)

}

function pesquisar_v2(elemento, col) {
    var termo = String(elemento.value).toLowerCase();
    filtros_produtos[col] = termo;

    var tabela_itens = document.getElementById('tabela_itens');
    var tbody = tabela_itens.querySelector('tbody');
    var trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td');
        var mostrar_linha = true;

        for (let filtro_col in filtros_produtos) {
            var termo_salvo = filtros_produtos[filtro_col];
            var texto_coluna = String(tds[filtro_col]?.textContent || "").toLowerCase();

            if (!texto_coluna.includes(termo_salvo)) {
                mostrar_linha = false;
                break;
            }
        }

        tr.style.display = mostrar_linha ? 'table-row' : 'none';
    });
}

function mudar_tabela_pesquisa(tabela) {

    tabela_atual = tabela
    tabela_produtos_v2()
    total()

}

async function recuperar_composicoes(tipo_tabela) {
    let nuvem = await receber('dados_composicoes')
    await inserirDados(nuvem, 'dados_composicoes')
    await tabela_produtos_v2(tipo_tabela)
}

async function tabela_produtos_v2(tipo_tabela) {

    let tabela_itens = document.getElementById('tabela_itens')
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (tabela_itens) {
        tabela_itens.innerHTML = '';

        let dados_composicoes = await recuperarDados('dados_composicoes') || {}

        if (Object.keys(dados_composicoes) == 0) {
            await recuperar_composicoes(tipo_tabela)
        }

        let linhas = ''

        for (codigo in dados_composicoes) {
            let produto = dados_composicoes[codigo]

            if (tipo_tabela == produto.tipo || tipo_tabela == undefined) {

                let preco = 0
                let ativo = 0
                let historico = 0
                let lpu;

                if (document.getElementById('lpu')) {
                    lpu = String(document.getElementById('lpu').value).toLowerCase()
                } else {
                    lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
                }

                if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
                    ativo = produto[lpu].ativo
                    historico = produto[lpu].historico
                    preco = historico[ativo]?.valor || 0
                }

                if (produto.status != "INATIVO") {

                    let td_quantidade = `
                    <input type="number" class="numero-bonito" oninput="incluir_item('${codigo}', this.value)">
                    `
                    if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo] && orcamento_v2.dados_composicoes[codigo].agrupamentos) {
                        td_quantidade = `
                        <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                            <img src="gifs/lampada.gif" style="width: 25px; heigth: 25px;">
                            <label>Lançar avulso</label>
                        </div>
                        <input type="number" class="numero-bonito" style="background-color: orange;" oninput="incluir_item('[AVULSO] ${codigo}', this.value)">
                        `
                    }

                    var imagem = 'https://i.imgur.com/Nb8sPs0.png'
                    if (produto.imagem) {
                        imagem = produto.imagem
                    }

                    linhas += `
                        <tr>
                            <td style="white-space: nowrap;">${codigo}</td>
                            <td style="position: relative;">
                                <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                                    <img src="imagens/editar.png" style="width: 1.5vw; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')">
                                    <label>${produto.descricao}</label>
                                </div>
                                ${(produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) ? `<img src="gifs/lampada.gif" style="position: absolute; top: 3px; right: 1vw; width: 1.5vw; cursor: pointer;">` : ''}
                            </td>
                            <td>${produto.fabricante}</td>
                            <td>${produto.modelo}</td>
                            <td>${produto.tipo}</td>
                            <td style="text-align: center;">${td_quantidade}</td>
                            <td>${produto.unidade}</td>
                            <td style="white-space: nowrap;">
                                <label onclick="abrir_historico_de_precos('${codigo}', '${lpu}')" class="${preco != 0 ? 'valor_preenchido' : 'valor_zero'}">${dinheiro(preco)}</label>
                            </td>
                            <td style="text-align: center;">
                                <img src="${imagem}" style="width: 70px; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')">
                            </td>
                        </tr>
                    `
                }
            }
        }

        let cores = {
            VENDA: '#B12425',
            SERVIÇO: 'green',
            undefined: 'rgb(179, 116, 0)'
        }

        let colunas = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Tipo', 'Quantidade', 'Unidade', 'Valor', 'Imagem *Ilustrativa']
        let ths = ''
        let tsh = ''
        colunas.forEach((col, i) => {
            ths += `<th style="color: white;">${col}</th>`
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input style="margin-left: 25px; text-align: left;" oninput="pesquisar_v2(this, ${i})">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>
            `
        })

        var acumulado = `
        <table class="tabela" style="background-color: ${cores[tipo_tabela]}">
            <thead>
                ${ths}
            </thead>
            <thead>
                ${tsh}
            </thead>
            <tbody>
                ${linhas}
            </tbody>
        </table>
        `

        tabela_itens.innerHTML = acumulado

    }

}

function alternar_icones(elemento, funcao, codigo) {

    let icones = elemento.querySelectorAll('img.img_ag')
    icones.forEach(img => {
        img.remove()
    })

    if (funcao !== undefined) {
        let imagem = funcao == 'incluir' ? 'gifs/lampada.gif' : 'gifs/retornar.gif'
        let icone = `<img src="${imagem}" class="img_ag" onclick="funcoes_adicionais('${codigo}', '${funcao}')">`
        elemento.insertAdjacentHTML('beforeend', icone)
    }

}

function calcular_equipamentos(precos, retorno_esperado) {

    if (precos == undefined) {
        return
    }

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let img_difal = 'imagens/cancel.png'
    let difal = 0

    if (orcamento_v2.dados_orcam && orcamento_v2.dados_orcam.estado) {
        img_difal = 'imagens/concluido.png'
        let estado = orcamento_v2.dados_orcam.estado
        difal = estado == 'BA' ? difal = 20.5 - 4 : difal = 12 - 4
    }

    let dados = {};

    const calcularDados = () => {
        dados.valor_difal = precos.custo * (difal / 100);
        dados.valor_mais_margem = (precos.custo + dados.valor_difal) * (precos.margem / 100 + 1);
        dados.valor_imp_fed = dados.valor_mais_margem * 0.08;
        dados.valor_frete = dados.valor_mais_margem * 0.05 < 30 ? 30 : dados.valor_mais_margem * 0.05;
        dados.calculo = dados.valor_mais_margem + dados.valor_imp_fed + dados.valor_frete;
        dados.total_custos = dados.valor_difal + dados.valor_imp_fed + dados.valor_frete + precos.custo;
        dados.margem = dados.calculo - dados.total_custos;
        dados.retorno = (dados.margem / dados.calculo) * 100;
        dados.img_difal = img_difal;
        dados.difal = difal;
    };

    calcularDados();

    while (dados.retorno < retorno_esperado) {
        precos.margem += 1;
        calcularDados();
    }

    return dados

}

async function ajustar_valores(codigo) {

    let retorno_esperado = 20
    let input = document.getElementById('retorno')
    if (input && Number(input.value) > 20) {
        retorno_esperado = Number(input.value)
    }

    remover_popup()

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let lpu = orcamento_v2.lpu_ativa.toLowerCase()

    let precos = {
        custo: 0,
        lucro: 0
    }

    if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo] && orcamento_v2.dados_composicoes[codigo].precos) {
        precos = orcamento_v2.dados_composicoes[codigo].precos

    } else if (dados_composicoes[codigo] && dados_composicoes[codigo][lpu] && dados_composicoes[codigo][lpu].ativo && dados_composicoes[codigo][lpu].historico) {
        let historico = dados_composicoes[codigo][lpu].historico
        let ativo = dados_composicoes[codigo][lpu].ativo
        precos = historico[ativo]
        precos.margem = conversor(precos.margem) // Atualmente está armazenado como string;
    }

    let dados = calcular_equipamentos(precos, retorno_esperado)

    let acumulado = `
    <img src="imagens/BG.png" style="height: 100px; position: absolute; left: 3px; top: 3px;">
    <label style="font-size: 2vw;">Ajuste de valores</label>

    <div style="display: flex; flex-direction: column; gap: 10px; background-color: white; color: #151749; border-radius: 5px; padding: 5px;">

        <div style="display: flex; justify-content: center; align-items: center;">
            <label>Defina um percentual de retorno para este item:</label>
            <input id="retorno" type="numero" class="numero-bonito" value="${dados.retorno.toFixed(0)}">
            <img src="imagens/concluido.png" style="cursor: pointer;" onclick="ajustar_valores('${codigo}')">
        </div>

        <div style="display: flex; justify-content: center; align-items: center;">
            
            <table class="tabela">
                <thead>
                    <tr>
                        <th>Custo</th>
                        <th>DIFAL</th>
                        <th>Margem</th>
                        <th>Imp. Fed. 8%</th>
                        <th>Frete 5%</th>
                        <th>Custo Total</th>
                        <th>Retorno</th>
                        <th>Valor de Venda</th>
                    </tr>
                <thead>
                <tbody>
                    <tr>
                        <td>${dinheiro(precos.custo)}</td>
                        <td>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <label>${conversor(dados.difal)}%</label>
                            <label>${dinheiro(dados.valor_difal)}</label>
                            <img src="${dados.img_difal}" style="width: 25px; heigth: 25px;">
                        </div>
                        </td>
                        <td><label>${dados.margem.toFixed(0)}%</label></td>
                        <td>${dinheiro(dados.valor_imp_fed)}</td>
                        <td>${dinheiro(dados.valor_frete)}</td>
                        <td>${dinheiro(dados.total_custos)}</td>
                        <td>
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <label>${dinheiro(dados.margem)}</label>
                            <label class="numero" style="width: max-content: heigth: max-content: font-size: 2vw; padding: 5px; background-color: #4CAF50;">${dados.retorno.toFixed(0)}%</label>
                            </div>
                        </td>
                        <td>${dinheiro(dados.calculo)}</td>
                    </tr>
                </tbody>
            </table>

        </div>
    </div>
    `
    openPopup_v2(acumulado)

}

function equipamentos(elemento, incluir, codigo) {

    let imgs = elemento.querySelectorAll('img')
    imgs.forEach(im => {
        im.remove()
    })

    if (incluir) {
        let im = `
        <img src="imagens/construcao.png" class="img_ag" onclick="ajustar_valores('${codigo}')">
        `
        elemento.insertAdjacentHTML('beforeend', im)
    }

}

async function total() {

    let tabelas = ['serviço', 'venda']
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let desconto_acumulado = 0
    let totais = {
        serviço: { valor: 0, exibir: 'none' },
        venda: { valor: 0, exibir: 'none' },
        geral: { valor: 0, exibir: 'none', bruto: 0 }
    }

    tabelas.forEach(tabela => {
        let trs = document.getElementById(`linhas_${tabela}`).querySelectorAll('tr')

        if (trs.length > 0) {
            totais[tabela].exibir = 'block'
        } else {
            totais[tabela].exibir = 'none'
        }

        trs.forEach(tr => {
            let tds = tr.querySelectorAll('td')
            let codigo_original = tds[0].textContent
            let codigo = codigo_original

            if (codigo_original.includes('[AVULSO]')) {
                codigo = codigo.replace('[AVULSO]', '').trim()
            }

            let valor_unitario = 0
            let substituto = ''
            let acrescimo = 0

            if (lpu == 'lpu carrefour') { // Quantidade correspondente a mais 1 coluna: CARREFOUR;
                acrescimo = 1
            }

            if (dados_composicoes[codigo_original] && dados_composicoes[codigo_original].agrupamentos && Object.keys(dados_composicoes[codigo_original].agrupamentos).length > 0) {
                alternar_icones(tds[1], 'incluir', codigo_original)
            }

            let div = tds[1].querySelector('div.agrupados')
            let total = 0
            if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo_original] && orcamento_v2.dados_composicoes[codigo_original].agrupamentos) {
                let agrups = orcamento_v2.dados_composicoes[codigo_original].agrupamentos
                div.style.display = 'flex'
                let elementos = `
                    <div style="display: flex; justify-content: space-evenly;">
                        <label>Código</label>
                        <label>Descrição</label>
                        <label>Quantidade</label>
                        <label>Valor</label>
                        <label>Remover</label>
                    </div>
                    <hr style="width: 100%">
                `

                for (it in agrups) {

                    let item = dados_composicoes[it]
                    let valor = 0

                    if (item[lpu] && item[lpu].ativo && item[lpu].historico) {
                        valor = item[lpu].historico[item[lpu].ativo].valor
                    }

                    let cor = dados_composicoes[it].tipo == 'SERVIÇO' ? 'green' : '#B12425'

                    total += valor * agrups[it]
                    let estilo = valor * agrups[it] == 0 ? 'label_zerada' : ''
                    elementos += `
                    <div style="display: flex; justify-content: space-evenly; align-items: center; border: solid 1px ${cor}; margin: 2px; border-radius: 3px; background-color: white;">
                        <label>${it}</label>
                        <div onmouseover="exibir_descricao(this)" onmouseout="ocultar_descricao(this)" style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <div style="cursor: pointer; display: none; position: absolute; top: 0; background-color: white; padding: 5px; white-space: nowrap; border-radius: 3px; border: solid 1px #222;">${item.descricao}</div>
                            <label>${String(item.descricao).slice(0, 10)}...</label>
                        </div>
                        <div style="display: flex; justify-content: center;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <img src="imagens/up.png" style="width: 15px; cursor: pointer;" onclick="ajustar_quantidade('${codigo}', '${it}', true)">
                                <img src="imagens/down.png" style="width: 15px; cursor: pointer;" onclick="ajustar_quantidade('${codigo}', '${it}', false)">
                            </div>
                            <label class="numero" style="width: 20px; height: 20px;">${agrups[it]}</label>
                        </div>
                        <label class="${estilo}">${dinheiro(valor * agrups[it])}</label>
                        <img src="imagens/remover.png" style="width: 30px; height: 30px; cursor: pointer;" onclick="remover_adicional('${codigo}', '${it}')">
                    </div>
                    `
                }

                let div_interna = `
                <div style="display: flex; flex-direction: column; padding: 5px; background-color: #99999940; border-radius: 3px; font-size: 0.8vw;">
                    ${elementos}
                    <hr style="width: 100%;">

                    <div style="display: flex; width: 100%; justify-content: right;">
                        <label>Total</label>
                        <label class="total">${dinheiro(total)}</label>
                    </div>

                </div>
                `
                div.innerHTML = div_interna

                alternar_icones(tds[1], 'remover', codigo)

            } else {
                div.style.display = 'none'
                div.innerHTML = ''
            }

            if (lpu == 'lpu carrefour') {

                if (dados_composicoes[codigo] && dados_composicoes[codigo].substituto !== '') {
                    substituto = dados_composicoes[codigo].substituto
                    tds[1 + acrescimo].querySelector('label').textContent = dados_composicoes[substituto].descricaocarrefour
                }
            }

            let sub_ou_cod = substituto == '' ? codigo : substituto
            let precos = {
                custo: 0,
                lucro: 0
            }

            if (dados_composicoes[sub_ou_cod] && dados_composicoes[sub_ou_cod][lpu] && dados_composicoes[sub_ou_cod][lpu].ativo !== undefined) {

                let ativo = dados_composicoes[sub_ou_cod][lpu].ativo
                let historico = dados_composicoes[sub_ou_cod][lpu].historico
                precos = historico[ativo]
                precos.margem = conversor(precos.margem)
                valor_unitario = precos.valor

            }

            valor_unitario += total // Somando ao total do agrupamento, caso exista;
            let quantidade = Number(tds[3 + acrescimo].querySelector('input').value)
            let total_linha = valor_unitario * quantidade
            let label_icms_unitario = ''
            let label_icms_total = ''
            let cod = tds[0].textContent
            let tipo = dados_composicoes[cod].tipo
            let estilo = 'input_valor'

            // Desconto;
            let desconto = 0
            if (lpu !== 'lpu carrefour') {

                var tipo_desconto = tds[5 + acrescimo].querySelector('select')
                var valor_desconto = tds[5 + acrescimo].querySelector('input')

                if (tipo_desconto.value == 'Porcentagem') {
                    if (valor_desconto.value < 0) {
                        valor_desconto.value = 0
                    } else if (valor_desconto.value > 100) {
                        valor_desconto.value = 100
                    }

                    desconto = valor_desconto.value / 100 * total_linha

                } else {
                    if (valor_desconto.value < 0) {
                        valor_desconto.value = 0
                    } else if (valor_desconto.value > total_linha) {
                        valor_desconto.value = total_linha
                    }

                    desconto = Number(valor_desconto.value)

                }

                if (desconto == 0) {
                    tipo_desconto.classList = 'desconto_off'
                    valor_desconto.classList = 'desconto_off'
                } else {
                    tipo_desconto.classList = 'desconto_on'
                    valor_desconto.classList = 'desconto_on'
                }

                totais.geral.bruto += total_linha // Valor bruto sem desconto;
                total_linha = total_linha - desconto
                desconto_acumulado += desconto
            }
            // Final da lógica do Desconto;

            if (lpu.includes('equipamentos') && precos.custo > 0) {
                valor_unitario = calcular_equipamentos(precos, 20).calculo
            }

            if (tipo == 'VENDA' && orcamento_v2.dados_orcam) {

                let icms = orcamento_v2.dados_orcam.estado == 'BA' ? 0.205 : 0.12;

                if (icms) {

                    let unit_sem_icms = valor_unitario - (valor_unitario * icms)
                    let total_sem_icms = (1 - icms) * total_linha
                    label_icms_unitario += `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(unit_sem_icms)}</label>
                    `
                    label_icms_total = `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(total_sem_icms)}</label>
                    `
                }

            }

            totais[String(tipo).toLowerCase()].valor += total_linha
            totais.geral.valor += total_linha
            estilo = valor_unitario == 0 ? 'label_zerada' : estilo;

            let total_unitario = `
            <div>
                <label class="${estilo}"> ${dinheiro(valor_unitario)}</label>
                ${label_icms_unitario}
            </div>
            `
            let total_geral = `
            <div>
                <label class="${estilo}"> ${dinheiro(total_linha)}</label>
                ${label_icms_total}
            </div>
            `

            tds[4 + acrescimo].innerHTML = total_unitario
            if (lpu == 'lpu carrefour') {
                acrescimo = 0
            }
            tds[6 + acrescimo].innerHTML = total_geral
            tds[7 + acrescimo].innerHTML = `
            <label style="margin: 3px;">${tipo}</label>
            `
            //Equipamentos;
            equipamentos(tds[4 + acrescimo])
            if (lpu.includes('equipamentos') && valor_unitario !== 0) {
                equipamentos(tds[4 + acrescimo], true, sub_ou_cod)
            }
            //Fim dos equipamentos;

            if (!orcamento_v2.dados_composicoes) {

                orcamento_v2.dados_composicoes = {}

            }

            if (!orcamento_v2.dados_composicoes[codigo_original]) {
                orcamento_v2.dados_composicoes[codigo_original] = {}
            }

            let item_salvo = orcamento_v2.dados_composicoes[codigo_original]

            item_salvo.codigo = codigo
            item_salvo.qtde = quantidade
            item_salvo.custo = valor_unitario
            item_salvo.tipo = tipo

            if (lpu !== 'lpu carrefour' && Number(valor_desconto.value) !== 0) {
                item_salvo.tipo_desconto = tipo_desconto.value
                item_salvo.desconto = Number(valor_desconto.value)
            } else {
                delete item_salvo.tipo_desconto
                delete item_salvo.desconto
            }

        })

    })

    let esta_quieto = true;
    let desconto_calculo = 0;
    let desconto_geral = document.getElementById('desconto_geral')
    let tipo_de_desconto = desconto_geral.previousElementSibling

    if (desconto_geral !== '') {
        orcamento_v2.desconto_geral = desconto_geral.value
        orcamento_v2.tipo_de_desconto = tipo_de_desconto.value
    } else {
        delete orcamento_v2.desconto_geral
        delete orcamento_v2.tipo_de_desconto
    }

    for (tot in totais) {

        if (tot !== 'geral') {

            document.getElementById(tot).style.display = totais[tot].exibir
            totais[tot].exibir == 'block' ? esta_quieto = false : ''
            document.getElementById(`total_${tot}`).textContent = dinheiro(totais[tot].valor)

        } else if (lpu !== 'lpu carrefour') {

            if (desconto_geral.value !== '') {
                if (tipo_de_desconto.value == 'Porcentagem') {

                    if (desconto_geral.value < 0) {
                        desconto_geral.value = 0
                    } else if (desconto_geral.value > 100) {
                        desconto_geral.value = 100
                    }

                    desconto_calculo = (desconto_geral.value / 100) * totais[tot].valor

                } else {

                    if (desconto_geral.value < 0) {
                        desconto_geral.value = 0
                    } else if (desconto_geral.value > totais[tot].valor) {
                        desconto_geral.value = totais[tot].valor
                    }

                    desconto_calculo = Number(desconto_geral.value)

                }
            }
        }
    }

    desconto_geral_linhas = desconto_acumulado + desconto_calculo
    document.getElementById(`total_geral`).textContent = dinheiro(totais.geral.valor - desconto_calculo)

    let painel_desconto = document.getElementById('desconto_total')
    if (lpu !== 'lpu carrefour') {
        desconto_geral.parentElement.parentElement.style.display = 'flex'

        if (desconto_geral_linhas > totais.geral.valor) {
            desconto_geral_linhas = totais.geral.valor
        }

        let desc_porc = desconto_geral_linhas == 0 ? 0 : (desconto_geral_linhas / totais.geral.bruto * 100).toFixed(2)

        painel_desconto.innerHTML = `
            <div class="resumo">
                <label>RESUMO</label>
                <hr style="width: 100%;">
                <label>Total sem Desconto</label>
                <label style="font-size: 1.5vw;" id="total_sem_desconto">${dinheiro(totais.geral.bruto)}</label>
                <br>
                <label>Desconto R$</label>
                <label style="font-size: 1.5vw;" id="desconto_dinheiro">${dinheiro(desconto_geral_linhas)}</label>
                <br>
                <label>Desconto %</label>
                <label style="font-size: 1.5vw;">${desc_porc}%</label>
                <input style="display: none" id="desconto_porcentagem" value="${desc_porc}">
            </div>
        `
    } else {
        desconto_geral.parentElement.parentElement.style.display = 'none'
        painel_desconto.innerHTML = ''
    }

    orcamento_v2.total_geral = dinheiro(totais.geral.valor)
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    let quieto = document.getElementById('quieto')

    esta_quieto ? quieto.style.display = 'flex' : quieto.style.display = 'none'

    let aleatorio = Math.floor(Math.random() * metaforas.length)

    if (esta_quieto) {
        quieto.innerHTML = `
        <label class="novo_titulo">${metaforas[aleatorio]}</label>
        `
    }
}

function exibir_descricao(elemento) {
    let div = elemento.firstElementChild
    div.style.display = 'flex'
}

function ocultar_descricao(elemento) {
    let div = elemento.firstElementChild
    div.style.display = 'none'
}

function ajustar_quantidade(codigo, sub_item, ajuste) {
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let qt_ajuste = ajuste ? 1 : -1

    orcamento_v2.dados_composicoes[codigo].agrupamentos[sub_item] += qt_ajuste

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    total()
}

function remover_adicional(codigo, sub_item) {
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    delete orcamento_v2.dados_composicoes[codigo].agrupamentos[sub_item]

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    total()
}

function mostrar_ocultar_itens(elemento_img) {
    var div = elemento_img.parentElement.parentElement.querySelector('div.agrupados');

    if (div.style.display == 'none' || div.style.display === '') {
        div.style.display = 'flex';
        elemento_img.style.transform = 'rotate(180deg)';
    } else {
        div.style.display = 'none';
        elemento_img.style.transform = 'rotate(0deg)';
    }
}

async function incluir_item(codigo, nova_quantidade, especial) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let codigo_original = codigo
    if (String(codigo).includes('[AVULSO]')) {
        codigo = String(codigo).replace('[AVULSO]', '').trim()
    }

    var item = dados_composicoes[codigo]
    var colunas_carrefour = '';
    var imagem = dados_composicoes[codigo]?.imagem || 'https://i.imgur.com/Nb8sPs0.png';
    var lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }
    let produto = orcamento_v2?.dados_composicoes[codigo] || {}

    if (lpu == 'lpu carrefour') {

        var td_descricao = ''
        if (dados_composicoes[codigo] && dados_composicoes[codigo].substituto !== '') {
            var substituto = dados_composicoes[codigo].substituto;
            td_descricao = dados_composicoes[substituto].descricao

        } else {
            td_descricao = dados_composicoes[codigo]?.descricaocarrefour || '?'

        }

        colunas_carrefour = `
        <td>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                <img src="imagens/carrefour.png" style="width: 3vw;">
                <label>${td_descricao}</label>
            </div>
        </td>
        `
    }

    let linha = `
        <tr>
            <td>${codigo_original}</td>
            <td style="position: relative;">
                <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                    <img src="imagens/construcao.png" style="width: 1.2vw; width: 2vw; cursor: pointer;" onclick="abrir_agrupamentos('${codigo}')">
                    <label>${dados_composicoes[item.codigo].descricao}</label>
                </div>
                <div class="agrupados"></div>
            </td>
            ${colunas_carrefour}
            <td style="text-align: center;">${dados_composicoes[item.codigo].unidade}</td>
            <td style="text-align: center;">
                <input oninput="total()" type="number" class="numero-bonito" value="${nova_quantidade}">
            </td>
            <td style="position: relative;"></td>

            ${lpu !== 'lpu carrefour' ?
            `<td>
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                        <select onchange="total()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                            <option ${produto?.tipo_desconto == 'Porcentagem' ? 'selected' : ''}>Porcentagem</option>
                            <option ${produto?.tipo_desconto == 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                        </select>
                        <input type="number" oninput="total()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
                    </div>
                </td>
                ` : ''}

            <td></td>
            <td></td>
            <td style="text-align: center;">
                <img onclick="ampliar_especial(this, '${item.codigo}')" src="${imagem}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo_original}')" style="cursor: pointer;"></td>
        </tr>
        `

    if (item_existente(item.tipo, codigo_original, nova_quantidade)) {

        document.getElementById(`linhas_${String(item.tipo).toLowerCase()}`).insertAdjacentHTML('beforeend', linha)

    }

    if (!especial || especial == undefined) {
        await total()
    }

}

async function funcoes_adicionais(codigo, funcao) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (dados_composicoes[codigo].agrupamentos) {

        if (!orcamento_v2.dados_composicoes[codigo].agrupamentos) {
            orcamento_v2.dados_composicoes[codigo].agrupamentos = {}
        }

        if (funcao == 'incluir') {
            orcamento_v2.dados_composicoes[codigo].agrupamentos = dados_composicoes[codigo].agrupamentos

        } else if (funcao == 'remover') {

            delete orcamento_v2.dados_composicoes[codigo].agrupamentos
            // Caso exista um avulso, nesse momento ele será preservado como item original e sua versão avulsa será excluída;
            if (orcamento_v2.dados_composicoes[`[AVULSO] ${codigo}`]) {

                let tipo = String(orcamento_v2.dados_composicoes[`[AVULSO] ${codigo}`].tipo).toLowerCase()
                let tbody = document.getElementById(`linhas_${tipo}`)
                let trs = tbody.querySelectorAll('tr')
                let quantidade = orcamento_v2.dados_composicoes[`[AVULSO] ${codigo}`].qtde
                let acrescimo = orcamento_v2.lpu_ativa == 'LPU CARREFOUR' ? 1 : 0

                trs.forEach(tr => {
                    let tds = tr.querySelectorAll('td')
                    let cod = tds[0].textContent

                    if (cod == `[AVULSO] ${codigo}`) {
                        tr.remove()

                    } else if (cod == codigo) {
                        tds[3 + acrescimo].querySelector('input').value = quantidade

                    }

                })

                delete orcamento_v2.dados_composicoes[`[AVULSO] ${codigo}`]

            }

        }

        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    }

    total()
    alterar_input_tabela(codigo)

}

function alterar_input_tabela(codigo) {
    let tabela_itens = document.getElementById('tabela_itens')

    if (tabela_itens) {
        let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
        let table = tabela_itens.querySelector('table')
        let tbody = table.querySelector('tbody')
        let trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {

            let tds = tr.querySelectorAll('td')
            let cod = tds[0].textContent

            if (cod == codigo && orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]) {

                let td_quantidade = `
                <input type="number" class="numero-bonito" oninput="incluir_item('${codigo}', this.value)">
                `
                if (orcamento_v2.dados_composicoes[codigo].agrupamentos) {
                    td_quantidade = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                    <img src="gifs/lampada.gif" style="width: 25px; heigth: 25px;">
                    <label>Lançar avulso</label>
                </div>
                <input type="number" class="numero-bonito" style="background-color: orange;" oninput="incluir_item('[AVULSO] ${codigo}', this.value)">
                `
                }

                tds[5].innerHTML = td_quantidade

            }

        })

    }

}

function item_existente(tipo, codigo, quantidade) {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2'))
    let linhas = document.getElementById(`linhas_${tipo.toLocaleLowerCase()}`)
    let trs = linhas.querySelectorAll('tr')
    let incluir = true

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        let acrescimo = orcamento_v2.lpu_ativa !== 'LPU CARREFOUR' ? 0 : 1

        if (tds[0].textContent == codigo) {

            incluir = false
            tds[3 + acrescimo].querySelector('input').value = quantidade

        }

    })

    return incluir

}
