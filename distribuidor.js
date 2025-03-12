document.addEventListener("DOMContentLoaded", () => {
    carregar_distribuidores();
});

let filtro_distribuidor = {}
let filtro;

async function carregar_distribuidores(sincronizar) {
    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde());

    let dados_distribuidor = await recuperarDados('dados_distribuidor') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}

    if (Object.keys(dados_distribuidor).length == 0 || sincronizar) {
        await inserirDados(await receber('dados_distribuidor'), 'dados_distribuidor')
        dados_distribuidor = await recuperarDados('dados_distribuidor') || {}
    }

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }
    
    let linhas = ""
    let status_toolbar = []

    for (id in dados_distribuidor) {
        let distribuidor = dados_distribuidor[id]
        let dados_clientes = dados_clientes_omie[distribuidor.codigo_cliente] || {}
        let dados_tecnicos = dados_clientes_omie[distribuidor.codigo_tecnico] || {}

        status_toolbar.push(distribuidor.status_distribuidor)

        linhas += `
            <tr>
                <td>${distribuidor.data}</td>
                <td>${distribuidor.status_distribuidor}</td>
                <td>${distribuidor.chamado || 'SEM CHAMADO'}</td>
                <td>${dados_clientes.nome || '--'}</td>
                <td>${dados_tecnicos.nome || '--'}</td>
                <td>${dados_clientes.cidade || '--'}</td>
                <td>${salvarPrimeiroUsuario(distribuidor?.historico || distribuidor.usuario)}</td>
                <td>${dinheiro(distribuidor.valor) || '--'}</td>
                <td style="text-align: center;">
                    <img onclick="abrir_distribuidor('${id}')" src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
                </td>
            </tr>
            `

    }
    
    let colunas = ['Última alteração', 'Status', 'Chamado', 'Loja', 'Técnico', 'Cidade', 'Analista', 'Valor', 'Ações']
    let ths = "";
    let tsh = "";

    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`

        if (col == 'Ações') {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input placeholder="..." style="text-align: left;" oninput="filtrar_distribuidor(undefined, '${i}', this.value)">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>      
        `}
    })

    let tabela = `
        <table id="distribuidores" class="tabela" style="font-size: 0.8vw; width: 100%">
            <thead>
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="distribuidor-body">
                ${linhas}
            </tbody>
        </table>
    `;

    let div_distribuidores = document.getElementById("distribuidores");

    if (linhas !== '') {
        div_distribuidores.innerHTML = tabela

        filtrar_distribuidor('TODOS')
    }

    let aguarde = document.getElementById("aguarde");
    if (aguarde) {
        aguarde.remove();
    }
}

// 🔥 Função para filtrar os dados dinamicamente
function filtrar_distribuidor(ultimo_status, col, texto) {

    if (ultimo_status !== undefined) {
        filtro = ultimo_status
    }

    if (col !== undefined) {
        filtro_distribuidor[col] = String(texto).toLowerCase()
    }

    let tbody = document.getElementById('distribuidor-body')
    console.log(tbody)
    let trs = tbody.querySelectorAll('tr')
    let contadores = {
        TODOS: 0,
        listas: ['TODOS']
    }

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')
        let status = tds[1].textContent
        var mostrarLinha = true;

        for (var col in filtro_distribuidor) {
            var filtroTexto = filtro_distribuidor[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        if (filtro !== undefined) {
            mostrarLinha = mostrarLinha && (status == filtro || filtro == 'TODOS');
        }

        contadores.listas.push(status)
        if (!contadores[status]) {
            contadores[status] = 0
        }

        if (mostrarLinha || status !== filtro) {
            contadores[status]++
        }

        if (filtro !== 'TODOS' || (filtro == 'TODOS' && mostrarLinha)) {
            contadores['TODOS']++
        }

        mostrarLinha ? tr.style.display = 'table-row' : tr.style.display = 'none'
    })

    let toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''
    contadores.listas = [...new Set(contadores.listas)]

    // Acesse o array dentro do objeto `contadores`
    const listaOriginal = contadores.listas;

    // Nova ordem desejada
    const ordemDesejada = [
        "TODOS",
        "DISTRIBUIDOR",
        "REQUISIÇÃO AVULSA",
        "MATERIAL SEPARADO",
        "MATERIAL ENVIADO"
    ];

    // Remove "MATERIAL ENTREGUE" e reordena
    contadores.listas = ordemDesejada.filter(item => listaOriginal.includes(item));

    contadores.listas.forEach(st => {

        let bg = '#797979'
        let bg2 = '#3d3c3c'
        if ((filtro == st || (filtro == undefined && st == 'TODOS'))) {
            bg = '#d2d2d2'
            bg2 = '#222'
        }

        let label = `
        <div onclick="filtrar_distribuidor('${st}')" 
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
            ">

            <label>${inicial_maiuscula(st)}</label>
            <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st]}</label>

        </div>
        `
        toolbar.insertAdjacentHTML('beforeend', label)

    })

}

function criar_distribuidor(id) {

    let termo = 'Editar'
    let botao = 'Atualizar'
    let pdf = `
        <div onclick="capturar_html_pdf('${id}')" class="contorno_botoes" style="background-color: #B12425; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <img src="imagens/pdf.png" style="cursor: pointer; width: 2vw;">
            <label>PDF</label>
        </div>`
        let excluir = `
        <div style="background-color: transparent;;" onclick="confirmar_exclusao('${id}')" class="bex">
            <img src="imagens/cancel.png" style="cursor: pointer; width: 1vw; height: 1vw;">
            <label style="font-size: 1vw; color: white; cursor: pointer;">Excluir Manutenção</label>
        </div>
    `
    if (id == undefined) {
        termo = 'Criar'
        botao = 'Enviar para Logística'
        pdf = ''
        excluir = ''
        id = gerar_id_5_digitos()
    }

    let acumulado = `
        <img src="imagens/BG.png" style="height: 70px; position: absolute; top: 0; left: 0;">

        <label>${termo} <strong> Requisição de Materiais </strong> </label>

        <div style="position: relative;" id="tela">

            <div style="background-color: white; border-radius: 3px; padding: 5px; font-size: 0.9vw; width: 70vw;">

                <div
                    style="position: relative; display: flex; align-items: center; justify-content: start; color: #222; background-color: #d2d2d2; padding: 5px; border-radius: 3px;">
                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">

                        <label style="font-size: 1.2vw;">Cliente | Loja</label>
                        <label id="codigo_cliente" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="cliente" oninput="sugestoes(this, 'sug_cliente', 'clientes')"
                                placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_cliente"></div>
                        </div>

                        <div id="endereco_cliente"
                            style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                        </div>

                    </div>

                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                        <label style="font-size: 1.2vw;">TÉCNICO</label>
                        <label id="codigo_tecnico" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="tecnico" oninput="sugestoes(this, 'sug_tecnico', 'clientes')"
                                placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_tecnico"></div>
                        </div>

                        <div id="endereco_tecnico"
                            style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: start; gap: 5px;">
                        <div
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: start; gap: 20px;">
                            <label style="font-size: 1.2vw;">Status Distribuidor</label>
                            <select id="status_distribuidor"
                                style="padding: 5px; border-radius: 3px; cursor: pointer; width: 10vw; font-size: 0.8vw;">
                                <option>DISTRIBUIDOR</option>
                                <option>REQUISIÇÃO AVULSA</option>
                                <option>MATERIAL SEPARADO</option>
                                <option>MATERIAL ENVIADO</option>
                                <option>MATERIAL ENTREGUE</option>
                                <option>REPROVADO</option>
                            </select>
                        </div>
                        <div id="div_chamado"
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Chamado</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text"
                                placeholder="..." id="chamado">
                        </div>
                        <div id="div_valor"
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Valor</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="number" id="valor">
                        </div>
                        <div
                            style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                            <label style="font-size: 1.2vw;">Comentário</label>
                            <textarea type="text" placeholder="..." id="comentario"></textarea>
                        </div>
                    </div>

                </div>

                <br>

                <div class="tabela_distribuidor">
                    <div class="linha"
                        style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px;">
                        <div style="width: 25vw;">
                            <label>Descrição</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Quantidade</label>
                        </div>
                        <div style="width: 20vw;">
                            <label>Comentário</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Estoque</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Estoque Usado</label>
                        </div>
                        <div style="width: 5vw;">
                            <label>Remover</label>
                        </div>
                    </div>

                    <div id="linhas_distribuidor">
                        <div id="excluir_inicial" class="linha" style="width: 70vw;">
                            <label>Lista Vazia</label>
                        </div>
                    </div>

                </div>

                <br>

                <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                    <div onclick="adicionar_linha_dist()" class="contorno_botoes"
                        style="background-color: #151749; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/chamados.png" style="cursor: pointer; width: 2vw;">
                        <label>Adicionar Peça</label>
                    </div>
                    <div onclick="enviar_distribuidor('${id}')" class="contorno_botoes"
                        style="background-color: green; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/estoque.png" style="cursor: pointer; width: 2vw">
                        <label>${botao}</label>
                    </div>
                    ${pdf}
                    <div onclick="atualizar_base_clientes()" class="bex" style="background-color: brown; color: white;">
                        <img src="imagens/atualizar.png" style="cursor: pointer; width: 2vw;">
                        <label">Sincronizar Clientes/Técnicos</label>
                    </div>
                    <div onclick="recuperar_estoque()" class="bex" style="background-color: black; color: white;">
                        <img src="imagens/sync.png" style="cursor: pointer; width: 2vw;">
                        <label">Sincronizar Estoque</label>
                    </div>
                </div>

            </div>

        </div>

        <div id="historico"></div>

        <label id="data"
            style="position: absolute; bottom: 10px; right: 20px; font-size: 0.8vw;">${data_atual('completa')}</label>
        <label id="excluir"
            style="position: absolute; bottom: 2x; left: 20px; font-size: 0.8vw; cursor: pointer;">${excluir}</label>
    
    `
    openPopup_v2(acumulado)
}

function adicionar_linha_dist() {
    let tbody = document.getElementById('linhas_distribuidor')
    let aleatorio = gerar_id_5_digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
        <div class="linha_completa">
            <div class="linha">
                <div style="position: relative; width: 25vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;" type="text" id="${aleatorio}" oninput="sugestoes(this, 'sug_${aleatorio}', 'estoque')"></textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div>
                    <input id="input_${aleatorio}" style="display: none;">
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="number">
                </div>

                <div style="width: 20vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;"></textarea>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 5vw;">
                    <img src="imagens/remover.png" onclick="remover_esta_linha(this)" style="width: 30px; cursor: pointer;">
                </div>
            </div>
            <hr style="width: 100%; margin: 0px;">
        </div>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

async function sugestoes(textarea, div, base) {

    let div_sugestoes = document.getElementById(div)
    let query = String(textarea.value).toUpperCase()
    div_sugestoes.innerHTML = '';

    if (query === '') {
        let campo = div.split('_')[1]
        let endereco = document.getElementById(`endereco_${campo}`)

        if (endereco) {
            document.getElementById(`codigo_${campo}`).innerHTML = ''
            endereco.innerHTML = ''
            return
        }

        return
    }

    let dados = await recuperarDados(`dados_${base}`) || {}
    let opcoes = ''

    for (id in dados) {
        let item = dados[id]
        let info;
        let dados_endereco;
        let cod_omie;

        if (base == 'clientes') {
            cod_omie = item.omie
            info = String(item.nome)
            dados_endereco = `
            <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
            <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
            <label><strong>CEP:</strong> ${item.cep}</label>
            <label><strong>Cidade:</strong> ${item.cidade}</label>
            <label><strong>Estado:</strong> ${item.estado}</label>
        `.replace(/'/g, "&apos;")
                .replace(/"/g, "&quot;")
                .replace(/\r?\n|\r/g, "");

        } else if (base == 'estoque') {
            info = String(item.descricao)
        }

        if (info.includes(query)) {
            opcoes += `
                    <div onclick="definir_campo(this, '${div}', '${dados_endereco}', '${cod_omie}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
                `
        }
    }

    div_sugestoes.innerHTML = opcoes

}

function remover_esta_linha(div_menor) {
    let linha_completa = div_menor.closest('.linha_completa')
    if (linha_completa) {
        linha_completa.remove()
    }
}

async function enviar_distribuidor(id) {

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let campos = ['codigo_tecnico', 'codigo_cliente', 'comentario', 'status_distribuidor', 'data', 'chamado']
    let distribuidor = {}
    distribuidor.usuario = acesso.usuario
    distribuidor.analista = acesso.nome_completo

    let dados_distribuidor = await recuperarDados('dados_distribuidor') || {}

    distribuidor.historico = dados_distribuidor[id]?.historico || {}

    // Atualiza o status atual da requisição
    distribuidor.status_distribuidor = document.getElementById('status_distribuidor').value;

    distribuidor.valor = document.getElementById('valor').value

    // Adiciona uma nova entrada ao histórico
    let novaAtualizacao = {
        data: data_atual("completa"),
        status_distribuidor: distribuidor.status_distribuidor,
        usuario: distribuidor.usuario,
        comentario: document.getElementById('comentario').value
    };

    // Gera uma chave única para a nova atualização
    let chaveAtualizacao = gerar_id_5_digitos();
    distribuidor.historico[chaveAtualizacao] = novaAtualizacao;


    /*campos.forEach(campo => {
        let elemento = document.getElementById(campo);
        if (elemento) {
            distribuidor[campo] = elemento.value || elemento.textContent;
        }
    });*/


    let tabela = document.getElementById('linhas_distribuidor')
    let linhas = tabela.querySelectorAll('.linha')

    let pecas = {}
    linhas.forEach(linha => {
        let celulas = linha.querySelectorAll('input, textarea')
        if (celulas.length > 0) {
            pecas[gerar_id_5_digitos()] = {
                descricao: celulas[0].value,
                codigo: celulas[1].value,
                quantidade: celulas[2].value,
                comentario: celulas[3].value
            }
        }
    })

    distribuidor.pecas = pecas

    campos.forEach(campo => {
        let elemento = document.getElementById(campo)
        if (elemento) {
            distribuidor[campo] = elemento.value || elemento.textContent
        }
    })

    enviar(`dados_distribuidor/${id}`, distribuidor)
    dados_distribuidor[id] = distribuidor

    await inserirDados(dados_distribuidor, 'dados_distribuidor')

    remover_popup()

    await carregar_distribuidores()

}

function confirmar_exclusao(id) {

    openPopup_v2(`
        <div style="display: flex; align-items: center; justify-content: center; gap: 2vw;">
            <img src="gifs/alerta.gif" style="width: 3vw;">
            <label>Confirmar exclusão?</label>
            <button style="font-size: 1vw;" onclick="excluir_distribuidor('${id}')">Confirmar</button>
        </div>
        `)

}

async function excluir_distribuidor(id) {

    let dados_distribuidor = await recuperarDados('dados_distribuidor') || {}

    delete dados_distribuidor[id]

    await inserirDados(dados_distribuidor, 'dados_distribuidor')

    deletar(`dados_distribuidor/${id}`)

    remover_popup()

    await carregar_distribuidores()

}

async function atualizar_base_clientes() {

    if (document.getElementById('tela')) {

        document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

        await recuperar_clientes()

        let aguarde = document.getElementById('aguarde')
        if (aguarde) {
            aguarde.remove()
        }

    }

}

async function recuperar_estoque() {

    if (document.getElementById('tela')) {

        document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

        let estoque_nuvem = await receber('dados_estoque') || {}
        await inserirDados(estoque_nuvem, 'dados_estoque')

        let aguarde = document.getElementById('aguarde')
        if (aguarde) {
            aguarde.remove()
        }

    }

}

async function definir_campo(elemento, div, string_html, omie, id) {

    let campo = String(div).split('_')[1]

    if (campo == 'tecnico' || campo == 'cliente') {

        let endereco = document.getElementById(`endereco_${campo}`)
        endereco.innerHTML = string_html.replace(/&apos;/g, "'").replace(/&quot;/g, '"');

    } else {

        let input_aleatorio = document.getElementById(`input_${campo}`)
        input_aleatorio.value = id

        let dados_estoque = await recuperarDados('dados_estoque') || {}
        let estoques = ['estoque', 'estoque_usado']

        let dic_quantidades = {}

        estoques.forEach(estoque => {

            let estoque_do_objeto = dados_estoque[id][estoque]
            let historicos = estoque_do_objeto.historico
            dic_quantidades[estoque] = estoque_do_objeto.quantidade

            for (his in historicos) {
                let historico = historicos[his]

                if (historico.operacao == 'entrada') {
                    dic_quantidades[estoque] += historico.quantidade
                } else if (historico.operacao == 'saida') {
                    dic_quantidades[estoque] -= historico.quantidade
                }
            }

            let div_linha = input_aleatorio.parentElement.parentElement

            let inputs = div_linha.querySelectorAll('input, textarea')

            inputs[4].value = dic_quantidades.estoque
            inputs[5].value = dic_quantidades.estoque_usado

        })

    }

    let codigo = document.getElementById(`codigo_${campo}`)
    if (codigo) {
        codigo.textContent = omie
    }
    document.getElementById(campo).value = elemento.textContent
    document.getElementById(div).innerHTML = '' // Sugestões
}

function salvarPrimeiroUsuario(historico) {

    
    // Verifica se o objeto de histórico existe e não está vazio
    if (historico && dicionario(historico)) {
        // Obtém a primeira chave do objeto
        const primeiraChave = Object.keys(historico)[0];
        // Retorna o nome do usuário do primeiro registro
        return historico[primeiraChave].usuario
    }
    // Retorna null se o histórico estiver vazio ou não existir
    return historico;
}

async function abrir_distribuidor(id) {
    let dados_distribuidor = await recuperarDados('dados_distribuidor') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let dados_clientes_omie = {}

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    await criar_distribuidor(id)
    let distribuidor = dados_distribuidor[id]
    let pecas = distribuidor.pecas

    document.getElementById('comentario').value = distribuidor.comentario
    document.getElementById('status_distribuidor').value = distribuidor.status_distribuidor
    document.getElementById('chamado').value = distribuidor.chamado
    document.getElementById('valor').value = distribuidor.valor

    let pessoas = ['tecnico', 'cliente']

    pessoas.forEach(pessoa => {

        let chave = `codigo_${pessoa}`

        if (distribuidor[chave] && distribuidor[chave] !== '') {

            let item = dados_clientes_omie[distribuidor[chave]]
            document.getElementById(chave).textContent = distribuidor[chave]
            document.getElementById(pessoa).value = item.nome
            document.getElementById(`endereco_${pessoa}`).innerHTML = `
                <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
                <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
                <label><strong>CEP:</strong> ${item.cep}</label>
                <label><strong>Cidade:</strong> ${item.cidade}</label>
                <label><strong>Estado:</strong> ${item.estado}</label>        
            `
        }
    })

    let tamanho = Object.keys(pecas).length
    for (let i = 0; i < tamanho; i++) {
        adicionar_linha_dist()
    }

    let linhas_distribuidor = document.getElementById('linhas_distribuidor')
    let linhas = linhas_distribuidor.querySelectorAll('.linha')

    let i = 0
    for (id_peca in pecas) {
        let peca = pecas[id_peca]
        let celulas = linhas[i].querySelectorAll('input, textarea')

        let estoques = ['estoque', 'estoque_usado']

        let dic_quantidades = {}

        estoques.forEach(estoque => {

            let estoque_do_objeto = dados_estoque[peca.codigo][estoque]
            let historicos = estoque_do_objeto.historico
            dic_quantidades[estoque] = estoque_do_objeto.quantidade

            for (his in historicos) {
                let historico = historicos[his]

                if (historico.operacao == 'entrada') {
                    dic_quantidades[estoque] += historico.quantidade
                } else if (historico.operacao == 'saida') {
                    dic_quantidades[estoque] -= historico.quantidade
                }
            }

        })

        celulas[0].value = peca.descricao
        celulas[1].value = peca.codigo
        celulas[2].value = peca.quantidade
        celulas[3].value = peca.comentario
        celulas[4].value = dic_quantidades.estoque
        celulas[5].value = dic_quantidades.estoque_usado

        i++
    }

    let div_historico = document.getElementById('historico')

    let historicos = distribuidor.historico || {};

    //exibe o primeiro registro (criação) com "Criado Por" e container principal
    let infos = "";


    //exibe os registro subsequentes (alterações) com "Alterado Por"
    for (his in historicos) {
        let historico = historicos[his]
        let imagem;

        switch (historico.status_distribuidor) {
            case 'DISTRIBUIDOR':
                imagem = 'avencer'
                break
            case 'REQUISIÇÃO AVULSA':
                imagem = 'avulso'
                break
            case 'MATERIAL SEPARADO':
                imagem = 'estoque'
                break
            case 'MATERIAL ENVIADO':
                imagem = 'logistica'
                break
            case 'MATERIAL ENTREGUE':
                imagem = 'concluido'
                break
            default:
                imagem = 'cancel'
        }

        infos += `
        <div style="display: flex; align-items: center; justify-content: space-evenly; margin-bottom: 10px;">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; font-size: 0.8vw;">
                    <label><strong>Data: </strong>${historico.data}</label>
                    <label><strong>Status: </strong>${historico.status_distribuidor}</label>
                    <label><strong>Usuário: </strong>${historico.usuario}</label>
                    <label><strong>Comentário: </strong></label>
                    <textarea style="width: 100%; background-color: white; border: 1px solid #ccc; padding: 5px; resize: none;" readonly>${historico.comentario}</textarea>
                </div>
                <img src="imagens/${imagem}.png" style="width: 50px; margin-left: 10px;">
            </div>
    `;
    }

    let elemento = `
        <br>
            
            <div style="background-color: #151749; border-top-left-radius: 3px; border-top-right-radius: 3px; width: 70vw; padding: 5px;">Histórico</div>

            <div style="width: 70vw; background-color: #d2d2d2; color: #222; padding: 5px;">
                ${infos}
            </div>
        `

    div_historico.insertAdjacentHTML('beforeend', elemento)



}

async function capturar_html_pdf(id) {

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let dados_distribuidor = await recuperarDados('dados_distribuidor') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}
    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    let distribuidor = dados_distribuidor[id]
    let campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    let pessoas = ['tecnico', 'cliente']
    let divs = ''

    pessoas.forEach(pessoa => {
        let elementos = ''
        let codigo = distribuidor[`codigo_${pessoa}`]

        if (codigo !== '') {
            let dados = dados_clientes_omie[codigo] || {}

            campos.forEach(campo => {
                elementos += `<label style="text-align: left;"><strong>${campo.toUpperCase()}: </strong>${dados[campo]}</label>`
            })

            divs += `
                <div style="display: flex; flex-direction: column; aling-items: start; justify-content: left;">
                    <label style="font-size: 1.5em;">${pessoa.toUpperCase()}</label>
                    ${elementos}
                </div>
        `}
    })

    let cabecalho = `
        <div style="display: flex; align-items: start; justify-content: left; gap: 10vw;">
            ${divs}
        </div>
    `

    let pecas = distribuidor.pecas
    let linhas = ''
    for (pc in pecas) {
        let peca = pecas[pc]
        linhas += `
        <tr>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario}</td>
            <td>${peca.descricao}</td>
        </tr>
        `
    }

    let tabela = `
        <label style="font-size: 1.5em;">REQUISIÇÃO ${distribuidor.chamado}</label>
        <table>
            <thead>
                <th>Quantidade</th>
                <th>Comentário</th>
                <th>Descrição</th>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    `

    let html = `
        <html>

        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    justify-content: start;
                    align-items: start;
                    padding: 3vw;
                    gap: 10px;    
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.0em;
                }

                table {
                    font-size: 1.0em;
                    border-collapse: collapse;
                }
                
                th {
                    background-color: #d2d2d2;
                }

                th, td {
                    border: 1px solid #222;
                    padding: 3px;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    header,
                    footer {
                        display: none !important;
                    }

                    .table-container {
                        margin-right: 0;
                    }
                }                    
            
            </style>
        </head>

        <body>
            <div style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 20px;">
                <img src="https://i.imgur.com/qZLbNfb.png" style="width: 20vw; border-radius: 3px;">
                <label style="font-size: 2.0em;">Requisição de Materiais <br> Distribuidor/Avulso</label>
            </div>
            <hr style="width: 90%;">
            ${cabecalho}
            <hr style="width: 90%;">
            ${tabela}
        </body>

        </html>
    `;

    let nome = `REQUISICAO ${distribuidor.chamado}`

    await gerar_pdf_online(html, nome);

    remover_popup()
    await abrir_distribuidor(id)
}