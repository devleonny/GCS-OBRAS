var filtrosAtivos = {}
var intervaloCompleto
var intervaloCurto
var filtro;

preencher_orcamentos_v2()

// function filtrar_orcamentos(ultimo_status, col, texto, apenas_toolbar) {

//     // Resetar filtro para ORÇAMENTOS se não houver filtro definido
//     if (ultimo_status === undefined && filtro === undefined) {
//         filtro = 'ORÇAMENTOS'
//     }

//     if (ultimo_status !== undefined) {
//         filtro = ultimo_status
//     }

//     if (col !== undefined) {
//         filtrosAtivos[col] = String(texto).toLowerCase()
//     }

//     let linhas_orcamento = document.getElementById('linhas_orcamento')
//     let contadores = {
//         ORÇAMENTOS: 0,
//         listas: ['ORÇAMENTOS']
//     }

//     let trs = linhas_orcamento.querySelectorAll('tr')

//     trs.forEach(tr => {
//         let tds = tr.querySelectorAll('td')
//         let status = tds[1].querySelector('select').value

//         var mostrarLinha = true;

//         for (var col in filtrosAtivos) {
//             var filtroTexto = filtrosAtivos[col];
//             if (filtroTexto && col < tds.length) {
//                 let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
//                 let conteudoCelula = element.value ? element.value : element
//                 let texto_campo = String(conteudoCelula).toLowerCase()
//                 if (!texto_campo.includes(filtroTexto)) {
//                     mostrarLinha = false;
//                     break;
//                 }
//             }
//         }

//         if (!contadores.listas.includes(status)) {
//             contadores.listas.push(status)
//         }

//         if (!contadores[status]) {
//             contadores[status] = 0
//         }

//         contadores[status]++

//         const statusDiferenteDeOrcamentos = status !== 'ORÇAMENTOS'
//         if (statusDiferenteDeOrcamentos) {
//             contadores['ORÇAMENTOS']++
//         }

//         const filtroEDirefenteDeOrcamentos = filtro !== undefined && filtro !== 'ORÇAMENTOS'
//         if (filtroEDirefenteDeOrcamentos) {
//             mostrarLinha = mostrarLinha && (status == filtro);
//         }

//         const linhaEstaVisivel = apenas_toolbar !== true
//         if (linhaEstaVisivel) {
//             tr.style.display = mostrarLinha ? 'table-row' : 'none'
//         }

//     })

//     let toolbar = document.getElementById('toolbar')
//     toolbar.innerHTML = ''
//     contadores.listas = [...new Set(contadores.listas)]

//     let temp_fluxograma = {
//         'ORÇAMENTOS': {},
//         ...fluxograma
//     }

//     for (st in temp_fluxograma) {
//         if (contadores.listas.includes(st)) {

//             let bg = '#797979'
//             let bg2 = '#3d3c3c'
//             // Altere esta condição para verificar se o filtro é undefined ou 'ORÇAMENTOS'
//             if (filtro === st || (filtro === 'ORÇAMENTOS' && st === 'ORÇAMENTOS')) {
//                 bg = '#d2d2d2'
//                 bg2 = '#222'
//             }

//             let label = `
//                 <div onclick="filtrar_orcamentos('${st}')" 
//                     style="background-color:${bg}; 
//                     color: #222; 
//                     display: flex; 
//                     flex-direction: column;
//                     justify-content: center; 
//                     align-items: center; 
//                     gap: 3px;
//                     cursor: pointer;
//                     padding: 10px;
//                     font-size: 0.8vw;
//                     color: #222;
//                     border-top-left-radius: 5px;
//                     border-top-right-radius: 5px;
//                     "
//                 >

//                     <label>${inicial_maiuscula(st)}</label>
//                     <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st]}</label>

//                 </div>
//                 `
//             toolbar.insertAdjacentHTML('beforeend', label)
//         }
//     }

// }

function filtrar_orcamentos(ultimo_status, col, texto, apenas_toolbar) {
    filtro = ultimo_status

    const statusNaoExiste = ultimo_status === undefined && filtro === undefined
    if (statusNaoExiste) {
        filtro = 'ORÇAMENTOS'
    }

    const colExiste = col !== undefined
    if (colExiste) {
        filtrosAtivos[col] = String(texto).toLowerCase()
    }

    let linhas_orcamento = document.getElementById('linhas_orcamento')
    let trs = linhas_orcamento.querySelectorAll('tr')

    let contadores = {}

    contadores['ORÇAMENTOS'] = 0
    for (let st in fluxograma) {
        contadores[st] = 0
    }

    const QUANTIDADE_CELULA_STATUS = 2
    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')
        if (tds.length < QUANTIDADE_CELULA_STATUS) return

        let selectElement = tds[1].querySelector('select')
        if (!selectElement) return

        let status = selectElement.value

        if (contadores[status] === undefined) {
            contadores[status] = 1
        } else {
            contadores[status]++
        }

        if (status !== 'ORÇAMENTOS') {
            contadores['ORÇAMENTOS']++
        }
    })

    if (apenas_toolbar !== true) {
        trs.forEach(tr => {
            let tds = tr.querySelectorAll('td')
            if (tds.length < QUANTIDADE_CELULA_STATUS) return

            let selectElement = tds[1].querySelector('select')
            if (!selectElement) return

            let status = selectElement.value
            let mostrarLinha = true

            for (let col in filtrosAtivos) {
                let filtroTexto = filtrosAtivos[col]
                if (filtroTexto && col < tds.length) {
                    let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                    let conteudoCelula = element.value ? element.value : element
                    let texto_campo = String(conteudoCelula).toLowerCase()

                    if (!texto_campo.includes(filtroTexto)) {
                        mostrarLinha = false
                        break
                    }
                }
            }

            const filtroDiferenteDeOrcamentos = filtro !== 'ORÇAMENTOS'
            if (filtroDiferenteDeOrcamentos) {
                mostrarLinha = mostrarLinha && (status === filtro)
            }

            tr.style.display = mostrarLinha ? 'table-row' : 'none'
        })
    }

    let toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''

    adicionarBotaoFiltro('ORÇAMENTOS', contadores['ORÇAMENTOS'])

    const statusDoFluxogramaDiferenteDeOrcamentos = (st) => st !== 'ORÇAMENTOS'
    for (let st in fluxograma) {
        if (statusDoFluxogramaDiferenteDeOrcamentos(st)) {
            adicionarBotaoFiltro(st, contadores[st])
        }
    }

    function adicionarBotaoFiltro(st, contador) {
        let bg = (filtro === st) ? '#d2d2d2' : '#797979'
        let bg2 = (filtro === st) ? '#222' : '#3d3c3c'

        let label = `
            <div onclick="filtrar_orcamentos('${st}')" 
                style="background-color:${bg}; 
                color: #222; 
                display: flex; 
                flex-direction: column;
                justify-content: center; 
                align-items: center; 
                gap: 3px;
                cursor: pointer;
                padding: 10px;
                font-size: 0.8vw;
                color: #222;
                border-top-left-radius: 5px;
                border-top-right-radius: 5px;
                "
            >
                <label>${inicial_maiuscula(st)}</label>
                <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contador}</label>
            </div>
        `
        toolbar.insertAdjacentHTML('beforeend', label)
    }
}


async function preencher_orcamentos_v2() {

    var div_orcamentos = document.getElementById('orcamentos')
    if (!div_orcamentos) {
        return
    }

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    if (Object.keys(dados_orcamentos).length == 0) {
        await recuperar_orcamentos()
        dados_orcamentos = await recuperarDados('dados_orcamentos')
    }

    var desordenado = Object.entries(dados_orcamentos)
    desordenado.sort((a, b) => new Date(b[1].dados_orcam.data) - new Date(a[1].dados_orcam.data))
    dados_orcamentos = Object.fromEntries(desordenado)

    var linhas = ''

    for (orcamento in dados_orcamentos) {

        var orc = dados_orcamentos[orcamento]
        var dados_orcam = orc.dados_orcam
        var data = new Date(dados_orcam.data).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
        })

        var label_pedidos = ''
        var label_notas = ''

        if (orc.status && orc.status.historico) {
            let historico = orc.status.historico
            for (chave1 in historico) {

                let chave_historico = historico[chave1]
                let status = chave_historico.status

                if (status == 'PEDIDO') {

                    let num_pedido = chave_historico.pedido
                    let tipo = chave_historico.tipo

                    label_pedidos += `
                        <div class="etiqueta_pedidos"> 
                            <label style="font-size: 0.6vw;">${tipo}</label>
                            <label style="font-size: 0.7vw; margin: 2px;"><strong>${num_pedido}</strong></label>
                        </div>
                        `
                }

                if (chave_historico.notas) {
                    var nota = chave_historico.notas[0]

                    label_notas += `
                        <div class="etiqueta_pedidos">
                            <label style="font-size: 0.8em; margin: 2px;">${nota.modalidade}</label>
                            <label style="font-size: 1.1em; margin: 2px;"><strong>${nota.nota}</strong></label>
                        </div>
                    `
                }
            }
        }

        let st = 'INCLUIR PEDIDO'
        if (orc.status && orc.status) {
            st = orc.status.atual || 'INCLUIR PEDIDO'
        }

        let opcoes = ''
        for (fluxo in fluxograma) {
            opcoes += `
                <option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>
            `
        }

        linhas += `
            <tr>
                <td>${data}</td>
                <td>
                    <select style="font-size: 0.6vw;" onchange="alterar_status(this, '${orcamento}')">
                        ${opcoes}
                    </select>
                </td>
                <td>${label_pedidos}</td>
                <td>${label_notas}</td>
                <td>${dados_orcam.contrato}</td>
                <td>${dados_orcam.cliente_selecionado}</td>
                <td>${dados_orcam.cidade}</td>
                <td>${dados_orcam.analista}</td>
                <td style="white-space: nowrap;">${orc.total_geral}</td>
                <td style="white-space: nowrap;">${orc.lpu_ativa}</td>
                <td style="text-align: center;" onclick="exibir_todos_os_status('${orcamento}')">
                    <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
                </td>
            </tr>
            `
    }

    var cabecs = ['Última alteração', 'Status', 'Pedido', 'Notas', 'Chamado', 'Cliente', 'Cidade', 'Analista', 'Valor', 'LPU', 'Ações']
    var ths = ''
    var tsh = ''
    cabecs.forEach((cab, i) => {

        ths += `
            <th style="text-align: center;">${cab}</th>
            `
        if (cab !== 'Ações' && cab !== 'Aprovação') {
            tsh += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="position: relative;">
                        <input placeholder="..." style="text-align: left;" oninput="filtrar_orcamentos(undefined, ${i}, this.value)">
                        <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    </div>
                </th>
            `} else {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        }
    })

    let linhas_orcamento = document.getElementById('linhas_orcamento')

    if (linhas !== '') {

        if (linhas_orcamento) {
            linhas_orcamento.innerHTML = linhas

        } else {

            div_orcamentos.innerHTML = ''
            let tabela = `
                    <table id="orcamentos_" class="tabela" style="position: relative; font-size: 0.8vw; background-color: #d2d2d2;">
                        <thead>
                            <tr>${ths}</tr>
                            <tr id="tsh">${tsh}</tr>
                        </thead>
                        <tbody id="linhas_orcamento">
                            ${linhas}
                        </tbody>
                    </table>
                    `
            div_orcamentos.insertAdjacentHTML('beforeend', tabela)
        }

        filtrar_orcamentos('ORÇAMENTOS', undefined, undefined, false)

    }

}

async function recuperar_orcamentos() {

    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    let dados_orcamentos = await receber('dados_orcamentos') || {}
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    if (document.title == 'ORÇAMENTOS') {

        await preencher_orcamentos_v2()

    }

    document.getElementById("aguarde").remove()
}

async function editar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let orcamento_v2 = dados_orcamentos[orcam_]

    if (orcamento_v2.aprovacao) {
        delete orcamento_v2.aprovacao
    }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'

}

async function duplicar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    var orcamento_v2 = dados_orcamentos[orcam_]

    delete orcamento_v2.id

    orcamento_v2.dados_orcam.contrato = ''
    orcamento_v2.dados_orcam.analista = acesso.nome_completo
    orcamento_v2.dados_orcam.email_analista = acesso.email
    orcamento_v2.dados_orcam.telefone_analista = acesso.telefone

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    window.location.href = 'adicionar.html'
}

function salvar_dados_em_excel() {
    var tabela = orcamento_.querySelectorAll('tr');
    var dados = [];

    // Processa o cabeçalho (primeira linha da tabela)
    var cabecalho = tabela[0].querySelectorAll('th');
    var linhaCabecalho = [];
    cabecalho.forEach(th => {
        linhaCabecalho.push(th.textContent);
    });

    dados.push(linhaCabecalho); // Adiciona o cabeçalho ao array 'dados'

    // Processa o restante das linhas (linhas com dados)
    tabela.forEach((tr, index) => {
        if (index === 0) return; // Ignora o cabeçalho

        var tds = tr.querySelectorAll('td');
        var linha = [];
        tds.forEach(td => {
            linha.push(td.textContent);
        });

        dados.push(linha); // Adiciona a linha de dados ao array 'dados'
    });

    // Gera o arquivo Excel com ExcelJS
    var workbook = new ExcelJS.Workbook();
    var worksheet = workbook.addWorksheet('Orcamento');

    // Adiciona os dados ao worksheet
    dados.forEach((linha, index) => {
        worksheet.addRow(linha);
    });

    // Define a largura automática para as colunas
    worksheet.columns.forEach(column => {
        var maxLength = 0;
        column.eachCell({ includeEmpty: true }, function (cell) {
            var columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : 20;
    });

    workbook.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'dados_orcamento.xlsx');
    });
}

// Função usada para reorganizar os dados_orcamentos; 13-02-2025
async function alteracoes_status() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    for (id in dados_orcamentos) {
        let orcamento = dados_orcamentos[id]

        if (orcamento.levantamentos) {
            let novo_levantamentos = {};

            for (let lev in orcamento.levantamentos) {
                let adentro = orcamento.levantamentos[lev];

                while (adentro && typeof adentro[lev] === 'object') {
                    adentro = adentro[lev];
                }

                novo_levantamentos[lev] = adentro;
            }

            orcamento.levantamentos = novo_levantamentos;
        }

        if (orcamento.status) {

            let chaves = orcamento.status

            let novas_chaves = {}

            for (chave1 in chaves) {
                let pedido = chaves[chave1]
                let historicos = pedido.historico

                if (!novas_chaves[chave1]) {
                    novas_chaves[chave1] = {}
                }

                if (pedido.status == 'FINALIZADO') {
                    novas_chaves[chave1].finalizado = true
                }

                for (chave2 in historicos) {
                    let his = historicos[chave2]
                    his.status = atualizar_status(his.status)

                    if (his.status == 'PEDIDO') {
                        his.pedido = pedido.pedido
                        his.valor = pedido.valor
                        his.tipo = pedido.tipo
                    }

                    if (!novas_chaves[chave1].historico) {
                        novas_chaves[chave1].historico = {}
                    }

                    novas_chaves[chave1].historico[chave2] = his
                }

            }

            orcamento.status = novas_chaves

        }
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
}

function atualizar_status(st) {

    switch (true) {
        case st.includes('ANEXADO'):
            st = 'PEDIDO'
            break
        case st.includes('FATURAMENTO PEDIDO DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('REMESSA DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('FATURADO'):
            st = 'FATURADO'
            break
        case st == '':
            st = 'PEDIDO'
            break
        default:
            st = st
    }

    return st
}
