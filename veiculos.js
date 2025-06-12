document.addEventListener('DOMContentLoaded', async () => {
    await sincronizarDados('dados_veiculos');
    await montarPainelVeiculos();
});

function montarPainelVeiculos() {
    const container = document.getElementById('tabelaRegistro');
    if (!container) return;

    container.innerHTML = criarLayoutPrincipal();

    const btnCadastrarVeiculo = container.querySelector('#btnCadastrarVeiculo');
    if (btnCadastrarVeiculo) {
        btnCadastrarVeiculo.addEventListener('click', cadastrarVeiculo);
    }

    const filtro = container.querySelector('.veiculos-toolbar-filtro');
    const tbody = container.querySelector('#tabelaMotoristas');

    botoesVeiculos(filtro, tbody);
}

function criarLayoutPrincipal() {
    return `
        <div class="veiculos-toolbar-container">
            <div class="veiculos-toolbar-filtro">
                <button class="botao-cadastro-veiculo" id="btnCadastrarVeiculo">
                    Cadastrar Veículo
                </button>
                <label>Veículos</label>
            </div>
            
            <div class="veiculos-area-tabela">
                <button class="botao-cadastro-motorista" onclick="abrirFormularioCadastro()">
                    Cadastrar Novo Motorista
                </button>

                <div id="campoTotalMensal" class="total_geral">
                    Total mensal: R$ 0,00
                </div>
                
                <table class="tabela">
                    <thead class="ths">
                        <tr>
                            <th>Motoristas</th>
                            <th>Dados Veículo</th>
                            <th>Custo Mensal Veículo</th>
                            <th>Combustível</th>
                            <th>Pedágio</th>
                            <th>Estacionamento</th>
                            <th>Multas</th>
                            <th>Custos Extras</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tabelaMotoristas"></tbody>
                </table>
            </div>
        </div>
    `;
}

function cadastrarVeiculo() {
    const form = `
        <div class="form-cadastro-veiculo">
            <div class="form-grupo">
                <label>Nome do Veículo</label>
                <div class="autocomplete-container">
                    <input 
                        type="text" 
                        id="nome_veiculo" 
                        class="autocomplete-input"
                        placeholder="Ex: Mobi"
                        oninput="filtrarVeiculos(this)"
                    >
                    <div class="autocomplete-list"></div>
                </div>
            </div>

            <div class="form-grupo">
                <label>Frota</label>
                <input type="text" id="placa_frota" placeholder="Placa">
                <input type="text" id="modelo_frota" placeholder="Modelo">
                <select id="status_frota">
                    <option value="">Selecione o status</option>
                    <option value="locado">Locado</option>
                    <option value="devolvido">Devolvido</option>
                </select>
            </div>

            <div class="botoes-form">
                <button class="botao-form primario" onclick="salvarVeiculo()">
                    Cadastrar Veículo
                </button>
            </div>
        </div>
    `;

    openPopup_v2(form, 'Cadastro de Veículo');
}

async function filtrarVeiculos(input) {
    const div = input.nextElementSibling;
    const pesquisa = input.value.toLowerCase().trim();

    if (!pesquisa) {
        div.innerHTML = '';
        return;
    }

    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };

        const veiculosFiltrados = Object.keys(dados_veiculos.veiculos)
            .filter(nome => nome !== 'timestamp' && nome.includes(pesquisa))
            .sort();

        let opcoesHtml = '';
        veiculosFiltrados.forEach(nome => {
            const frotasCount = Object.keys(dados_veiculos.veiculos[nome].frotas || {}).length;
            opcoesHtml += `
                <div 
                    class="autocomplete-item" 
                    onclick="selecionarVeiculoExistente('${nome}')"
                >
                    <div class="autocomplete-item-content">
                        <label class="autocomplete-item-title">${nome.toUpperCase()}</label>
                        <label class="autocomplete-item-subtitle">
                            ${frotasCount} frota${frotasCount !== 1 ? 's' : ''} cadastrada${frotasCount !== 1 ? 's' : ''}
                        </label>
                    </div>
                </div>
            `;
        });

        div.innerHTML = opcoesHtml;

    } catch (error) {
        console.error('Erro ao filtrar veículos:', error);
    }
}

function selecionarVeiculoExistente(nome) {
    const input = document.getElementById('nome_veiculo');
    const div = input.nextElementSibling;

    input.value = nome;
    div.innerHTML = '';
}

async function salvarVeiculo() {
    try {
        const nomeVeiculo = document.getElementById('nome_veiculo').value.toLowerCase().trim();
        const placa = document.getElementById('placa_frota').value.trim();
        const modelo = document.getElementById('modelo_frota').value.trim();
        const status = document.getElementById('status_frota').value;

        const camposObrigatorios = [nomeVeiculo, placa, modelo];
        if (camposObrigatorios.some(campo => campo === '')) {
            openPopup_v2('Por favor, preencha os campos obrigatórios', 'Campo obrigatório', true);
            return;
        }

        await sincronizarDados('dados_veiculos');
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };

        if (!dados_veiculos.veiculos) {
            dados_veiculos.veiculos = {};
        }

        if (dados_veiculos.veiculos[nomeVeiculo]) {
            const frotasExistentes = dados_veiculos.veiculos[nomeVeiculo].frotas || {};
            if (Object.values(frotasExistentes).some(frota => frota.placa === placa)) {
                openPopup_v2(`
                    <div class="popup-message">
                        <img src="imagens/error.png">
                        <p>Já existe um veículo cadastrado com esta placa!</p>
                    </div>
                `, 'Erro');
                return;
            }

            dados_veiculos.veiculos[nomeVeiculo].frotas[placa] = {
                placa: placa,
                modelo: modelo,
                status: status
            };
        } else {
            dados_veiculos.veiculos[nomeVeiculo] = {
                frotas: {
                    [placa]: {
                        placa: placa,
                        modelo: modelo,
                        status: status
                    }
                },
                motoristas: {}
            };
        }

        await inserirDados(dados_veiculos, 'dados_veiculos');

        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}`, dados_veiculos.veiculos[nomeVeiculo]);

        const container = document.getElementById('tabelaRegistro');
        if (container) {
            container.innerHTML = criarLayoutPrincipal();
            const filtro = container.querySelector('.veiculos-toolbar-filtro');
            const tbody = container.querySelector('#tabelaMotoristas');
            await botoesVeiculos(filtro, tbody);
        }

        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/sucesso.png">
                <label>${dados_veiculos.veiculos[nomeVeiculo].frotas[placa] ? 'Nova frota adicionada' : 'Veículo cadastrado'} com sucesso!</label>
            </div>
        `, 'Sucesso');

        setTimeout(() => {
            remover_popup();
        }, 1500);

    } catch (error) {
        console.error('Erro ao salvar veículo:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao salvar veículo. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function botoesVeiculos(filtro) {
    try {
        const existingButtons = filtro.querySelectorAll('.filtro-veiculo');
        existingButtons.forEach(btn => btn.remove());

        await sincronizarDados('dados_veiculos');
        let dados_veiculos = await recuperarDados('dados_veiculos');

        if (!dados_veiculos || !dados_veiculos.veiculos) {
            console.log('Criando estrutura inicial de dados_veiculos');
            dados_veiculos = { veiculos: {} };
            await inserirDados(dados_veiculos, 'dados_veiculos');
        }

        const veiculosOrdenados = Object.entries(dados_veiculos.veiculos)
            .filter(([key, value]) => key !== 'timestamp' && typeof value === 'object')
            .map(([key]) => key)
            .sort();

        veiculosOrdenados.forEach(nomeVeiculo => {
            const btnHtml = `
                <button type="button" class="filtro-veiculo" onclick="selecionarVeiculo(this, '${nomeVeiculo}')">
                    ${nomeVeiculo.toUpperCase()}
                </button>
            `;
            filtro.insertAdjacentHTML('beforeend', btnHtml);
        });

        if (veiculosOrdenados.length > 0) {
            const firstButton = filtro.querySelector('.filtro-veiculo');
            if (firstButton) {
                selecionarVeiculo(firstButton, veiculosOrdenados[0]);
            }
        }

    } catch (error) {
        console.error('Erro ao carregar botões dos veículos:', error);
        openPopup_v2('Erro ao carregar lista de veículos. Tente novamente.', 'Erro');
    }
}

async function selecionarVeiculo(button, nomeVeiculo) {
    const filtro = button.closest('.veiculos-toolbar-filtro');
    filtro.querySelectorAll('button').forEach(b => b.classList.remove('selected'));

    button.classList.add('selected');

    try {
        await preencherTabelaMotoristas(nomeVeiculo.toLowerCase());
    } catch (error) {
        console.error('Erro ao selecionar veículo:', error);
    }
}

function criarLinhaMotorista(motorista, idMotorista, nomeVeiculo) {
    const custos = motorista.custo_mensal_veiculo?.custos || {};
    const totalCustos = Object.values(custos).reduce((total, item) => total + (Number(item.custo) || 0), 0);

    const combustivel = motorista.combustível || {};
    const pedagio = motorista.pedagio || {};
    const estacionamento = motorista.estacionamento || {};
    const multas = motorista.multas || {};
    const extras = motorista.custos_extras || {};

    const dadosVeiculo = encodeURIComponent(JSON.stringify(motorista.dados_veiculo));

    return `
        <tr>
            <td>${motorista.nome || ''}</td>
            <td>
                <button class="botao-dados-veiculo" onclick="mostrarDadosVeiculo('${dadosVeiculo}')">
                    Dados do Veículo
                </button>
            </td>
            <td>
                <button class="botao-custos" onclick="abrirPopupCustos('${idMotorista}', '${nomeVeiculo}', '${motorista.nome}')">
                    ${totalCustos > 0 ? dinheiro(totalCustos) : 'Adicionar Custos'}
                </button>
            </td>
            <td>${combustivel.litros ? `${combustivel.litros}L x ${combustivel.custo_litro} = ${combustivel.custo_total}` : ''}</td>
            <td>${pedagio.tag || ''}</td>
            <td>${estacionamento.tag || ''}</td>
            <td>${Object.keys(multas.anexos || {}).length ? 'Sim' : 'Não'}</td>
            <td>${extras.valor || ''}</td>
            <td style="text-align: center; width: max-content !important;">
                <img src="imagens/excluir.png" style="width: 2vw; cursor: pointer;" onclick="confirmarExclusaoMotorista('${idMotorista}', '${nomeVeiculo}', '${motorista.nome}')" title="Excluir motorista">
            </td>
        </tr>
    `;
}

async function confirmarExclusaoMotorista(idMotorista, nomeVeiculo, nomeMotorista) {
    openPopup_v2(`
        <div class="confirmar-exclusao-container">
            <img src="gifs/alerta.gif" class="confirmar-exclusao-imagem">
            <label>Tem certeza que deseja excluir o motorista ${nomeMotorista}?</label>
            <div class="confirmar-exclusao-botoes">
                <button onclick="remover_popup()" class="botao-cancelar">
                    Cancelar
                </button>
                <button onclick="excluirMotorista('${idMotorista}', '${nomeVeiculo}')" class="botao-confirmar-exclusao">
                    Confirmar Exclusão
                </button>
            </div>
        </div>
    `, 'Confirmar Exclusão');
}

async function excluirMotorista(idMotorista, nomeVeiculo) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || {};
        
        delete dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        await inserirDados(dados_veiculos, 'dados_veiculos');
        
        await deletar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`);

        remover_popup();
        
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/sucesso.png">
                <label>Motorista excluído com sucesso!</label>
            </div>
        `, 'Sucesso');

        await preencherTabelaMotoristas(nomeVeiculo);

        setTimeout(() => {
            remover_popup();
        }, 500);

    } catch (error) {
        console.error('Erro ao excluir motorista:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao excluir motorista. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

function mostrarDadosVeiculo(dadosVeiculoEncoded) {
    const dadosVeiculo = JSON.parse(decodeURIComponent(dadosVeiculoEncoded));

    const conteudo = `
        <div class="info">
            <div class="info-title">
                <img src="imagens/veiculo.png">
                <h3>Dados do Veículo</h3>
            </div>
            
            <div class="info-grupos">
                <div class="info-grupo">
                    <label>Placa:</label>
                    <span>${dadosVeiculo.placa || 'Não informado'}</span>
                </div>
                
                <div class="info-grupo">
                    <label>Modelo:</label>
                    <span>${dadosVeiculo.modelo || 'Não informado'}</span>
                </div>
                
                <div class="info-grupo">
                    <label>Status:</label>
                    <span style="color: ${dadosVeiculo.status === 'locado' ? 'green' : 'red'};">
                        ${dadosVeiculo.status || 'Não informado'}
                    </span>
                </div>
            </div>
        </div>
    `;

    openPopup_v2(conteudo, 'Informações do Veículo');
}

async function abrirPopupCustos(idMotorista, nomeVeiculo, nomeMotorista) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        
        if (!dados_veiculos?.veiculos?.[nomeVeiculo]?.motoristas?.[idMotorista]) {
            throw new Error('Motorista não encontrado');
        }

        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        if (!motorista.custo_mensal_veiculo) {
            motorista.custo_mensal_veiculo = { custos: {} };
        }

        const custos = motorista.custo_mensal_veiculo.custos;
        const totalCustos = Object.values(custos).reduce((total, item) => total + conversor(item.custo), 0);

        const conteudo = `
            <div class="custos-container">
                <h3>Custos Mensais - ${nomeMotorista}</h3>
                
                <div class="form-grupo form-custos">
                    <input type="number" id="novo-custo" placeholder="Valor do custo" step="0.01" min="0">
                    <textarea type="text" id="descricao-custo" placeholder="Descrição *limite de 500 caracteres" maxlength="500"></textarea>
                    <button onclick="adicionarCusto('${idMotorista}', '${nomeVeiculo}')" class="botao-form primario botao-custo">
                        Adicionar Custo
                    </button>
                </div>

                <table class="tabela">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Custo</th>
                            <th>Descrição</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="lista-custos">
                        ${Object.entries(custos).map(([idCusto, custo]) => `
                            <tr>
                                <td>${custo.data}</td>
                                <td>${dinheiro(custo.custo)}</td>
                                <td>${custo.descricao}</td>
                                <td style="text-align: center;">
                                    <img src="imagens/excluir.png" style="width: 2vw; cursor: pointer;" onclick="excluirCusto('${idMotorista}', '${nomeVeiculo}', '${idCusto}')" title="Excluir motorista">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Total:</strong></td>
                            <td><strong>${dinheiro(totalCustos)}</strong></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        openPopup_v2(conteudo, 'Custos Mensais');

    } catch (error) {
        console.error('Erro ao abrir popup de custos:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao carregar custos. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function adicionarCusto(idMotorista, nomeVeiculo) {
    const valor = document.getElementById('novo-custo').value;
    const descricao = document.getElementById('descricao-custo').value;

    if (!valor || !descricao) {
        openPopup_v2('Por favor, preencha todos os campos', 'Campos Obrigatórios', true);
        return;
    }

    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        if (!motorista.custo_mensal_veiculo) {
            motorista.custo_mensal_veiculo = { custos: {} };
        }

        const hoje = new Date();
        const dataFormatada = hoje.toLocaleDateString('pt-BR');

        const idCusto = gerar_id_5_digitos();
        motorista.custo_mensal_veiculo.custos[idCusto] = {
            custo: Number(valor),
            descricao: descricao,
            data: dataFormatada
        };

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        abrirPopupCustos(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao adicionar custo:', error);
        openPopup_v2('Erro ao adicionar custo. Tente novamente.', 'Erro');
    }
}

async function excluirCusto(idMotorista, nomeVeiculo, idCusto) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        delete motorista.custo_mensal_veiculo.custos[idCusto];

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        abrirPopupCustos(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao excluir custo:', error);
        openPopup_v2('Erro ao excluir custo. Tente novamente.', 'Erro');
    }
}

async function preencherTabelaMotoristas(nomeVeiculo) {
    const tbody = document.getElementById('tabelaMotoristas');
    const campoTotal = document.getElementById('campoTotalMensal');

    let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
    const veiculo = dados_veiculos.veiculos[nomeVeiculo];

    if (!tbody || !veiculo || !veiculo.motoristas) return;

    let total = 0;
    let linhasHtml = '';

    Object.entries(veiculo.motoristas).forEach(([idMotorista, motorista]) => {
        const custos = motorista.custo_mensal_veiculo?.custos || {};
        const totalCustos = Object.values(custos).reduce((total, item) => total + conversor(item.custo), 0);
        total += totalCustos;

        linhasHtml += criarLinhaMotorista(motorista, idMotorista, nomeVeiculo);
    });

    tbody.innerHTML = linhasHtml;

    if (campoTotal) {
        campoTotal.textContent = `Total mensal: ${dinheiro(total)}`;
    }
}

async function abrirFormularioCadastro() {
    await sincronizarDados('dados_veiculos');
    let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };

    let opcoesVeiculos = '<option value="">Selecione o veículo</option>';
    Object.entries(dados_veiculos.veiculos)
        .filter(([key]) => key !== 'timestamp')
        .forEach(([veiculo]) => {
            opcoesVeiculos += `<option value="${veiculo}">${veiculo.toUpperCase()}</option>`;
        });

    const form = `
        <div class="form-cadastro-motorista">
            <div class="form-grupo">
                <label>Nome do Motorista</label>
                <div class="autocomplete-container">
                    <input 
                        class="autocomplete-input"
                        id="nome_motorista"
                        type="text"
                        placeholder="Digite o nome do motorista..."
                        oninput="filtrarMotoristas(this)"
                    >
                    <div class="autocomplete-list"></div>
                </div>
            </div>
            
            <div class="form-grupo">
                <label>Selecione o Veículo</label>
                <select id="veiculo_selecionado" onchange="carregarFrotas(this.value)" required>
                    ${opcoesVeiculos}
                </select>
            </div>

            <div class="form-grupo">
                <label>Dados do Veículo</label>
                <label>Placa</label>
                <select id="placa" onchange="preencherDadosFrota(this.value)">
                    <option value="">Selecione a placa</option>
                </select>
                <label>Modelo</label>
                <input type="text" id="modelo" placeholder="Modelo" readonly>
                <label>Status</label>
                <input type="text" id="status" placeholder="status" readonly>
            </div>

            <div class="form-grupo">
                <button class="botao-form primario" onclick="cadastrarMotorista()">
                    Cadastrar Motorista
                </button>
            </div>
        </div>
    `;

    openPopup_v2(form, 'Cadastro de Motorista');
}

async function filtrarMotoristas(input) {
    const div = input.nextElementSibling;
    const pesquisa = input.value.toLowerCase().trim();

    if (!pesquisa) {
        div.innerHTML = '';
        return;
    }

    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
        let motoristasEncontrados = new Set();

        Object.entries(dados_veiculos.veiculos)
            .filter(([key]) => key !== 'timestamp')
            .forEach(([veiculo, dados]) => {
                Object.values(dados.motoristas || {}).forEach(motorista => {
                    if (motorista.nome.toLowerCase().includes(pesquisa)) {
                        motoristasEncontrados.add(JSON.stringify({
                            nome: motorista.nome,
                            veiculo: veiculo
                        }));
                    }
                });
            });

        let opcoesHtml = '';
        Array.from(motoristasEncontrados)
            .map(m => JSON.parse(m))
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .forEach(motorista => {
                opcoesHtml += `
                    <div class="autocomplete-item" onclick="selecionarMotoristaExistente('${motorista.nome}')">
                        <div class="autocomplete-item-content">
                            <label class="autocomplete-item-title">${motorista.nome}</label>
                            <label class="autocomplete-item-subtitle">Veículo: ${motorista.veiculo.toUpperCase()}</label>
                        </div>
                    </div>
                `;
            });

        div.innerHTML = opcoesHtml;
    } catch (error) {
        console.error('Erro ao filtrar motoristas:', error);
    }
}

function selecionarMotoristaExistente(nome) {
    const input = document.getElementById('nome_motorista');
    const div = input.nextElementSibling;
    
    input.value = nome;
    div.innerHTML = '';
}

async function carregarFrotas(veiculo) {
    const selectPlaca = document.getElementById('placa');
    selectPlaca.innerHTML = '<option value="">Selecione a placa</option>';

    if (!veiculo) return;

    let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
    const frotas = dados_veiculos.veiculos[veiculo]?.frotas || {};

    Object.values(frotas).forEach(frota => {
        selectPlaca.innerHTML += `
            <option value="${frota.placa}">${frota.placa}</option>
        `;
    });

    // Limpar campos
    document.getElementById('modelo').value = '';
    document.getElementById('status').value = '';
}

async function preencherDadosFrota(placa) {
    if (!placa) return;

    const veiculoSelecionado = document.getElementById('veiculo_selecionado').value;
    let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
    const frota = dados_veiculos.veiculos[veiculoSelecionado]?.frotas[placa];

    if (frota) {
        document.getElementById('modelo').value = frota.modelo;
        document.getElementById('status').value = frota.status;
    }
}

function selecionarMotorista(nome) {
    document.getElementById('nome_motorista').value = nome;
    document.querySelector('.autocomplete-list').innerHTML = '';
}

async function carregarMotoristas(textarea) {
    let div = textarea.nextElementSibling;
    let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
    let pesquisa = String(textarea.value).toLowerCase();
    div.innerHTML = '';

    if (pesquisa === '') return;

    let motoristas = new Set();

    for (let tipoVeiculo in dados_veiculos.veiculos) {
        let motoristasVeiculo = dados_veiculos.veiculos[tipoVeiculo].motoristas || {};
        for (let id in motoristasVeiculo) {
            let motorista = motoristasVeiculo[id];
            if (motorista.nome.toLowerCase().includes(pesquisa)) {
                motoristas.add(JSON.stringify({
                    id: id,
                    nome: motorista.nome,
                    veiculo: tipoVeiculo
                }));
            }
        }
    }

    let motoristasArray = Array.from(motoristas)
        .map(m => JSON.parse(m))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    motoristasArray.forEach(motorista => {
        opcoes += `
            <div onclick="selecionarMotorista('${motorista.id}', '${motorista.nome}', '${motorista.veiculo}', this)" 
                 class="autocomplete-item" 
                 style="text-align: left; padding: 5px; gap: 5px; display: flex; flex-direction: column; align-items: start; justify-content: start; border-bottom: solid 1px #d2d2d2;">
                <label style="font-size: 0.8vw;">${motorista.nome}</label>
                <label style="font-size: 0.7vw;"><strong>Veículo: ${motorista.veiculo}</strong></label>
            </div>
        `;
    });

    if (pesquisa === '') return;

    div.innerHTML = opcoes;
}

function selecionarMotorista(id, nome, veiculo, divOpcao) {
    let div = divOpcao.parentElement;
    let textarea = div.previousElementSibling;

    textarea.value = nome;
    div.innerHTML = '';
}

async function cadastrarMotorista() {
    const nome = document.getElementById('nome_motorista').value;
    const veiculoSelecionado = document.getElementById('veiculo_selecionado').value;
    const placa = document.getElementById('placa').value;
    const modelo = document.getElementById('modelo').value;
    const status = document.getElementById('status').value;

    const camposObrigatorios = [nome, veiculoSelecionado, placa];
    if (camposObrigatorios.some(campo => campo === '')) {
        openPopup_v2('Por favor, preencha os campos obrigatórios', 'Campos Obrigatórios', true);
        return;
    }

    try {
        await sincronizarDados('dados_veiculos');
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };

        const idMotorista = gerar_id_5_digitos();

        const novoMotorista = {
            nome: nome,
            dados_veiculo: {
                placa: placa,
                modelo: modelo,
                status: status
            }
        };

        if (!dados_veiculos.veiculos[veiculoSelecionado].motoristas) {
            dados_veiculos.veiculos[veiculoSelecionado].motoristas = {};
        }

        dados_veiculos.veiculos[veiculoSelecionado].motoristas[idMotorista] = novoMotorista;

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${veiculoSelecionado}/motoristas/${idMotorista}`, novoMotorista);

        await preencherTabelaMotoristas(veiculoSelecionado);

        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/sucesso.png">
                <label>Motorista cadastrado com sucesso!</label>
            </div>
        `, 'Sucesso');

        setTimeout(() => {
            remover_popup();
        }, 1500);

    } catch (error) {
        console.error('Erro ao cadastrar motorista:', error);
        openPopup_v2('Erro ao cadastrar motorista. Tente novamente.', 'Erro');
    }
}

async function atualizarListaMotoristas() {
    openPopup_v2(`
        <div style="display: flex; align-items: center; justify-content: left;">
            <img src="gifs/loading.gif" style="width: 50px">
            <label>Aguarde alguns segundos... </label>
        </div>
    `, 'Atualizando lista de motoristas');

    try {
        let dados_veiculos_atuais = await recuperarDados('dados_veiculos') || {};

        await sincronizarDados('dados_veiculos', true);
        let dados_veiculos_novos = await recuperarDados('dados_veiculos');

        const tbody = document.querySelector('#tabelaMotoristas');
        const campoTotal = document.getElementById('campoTotalMensal');

        const veiculoSelecionado = document.querySelector('.veiculos-toolbar-filtro button.selected');
        const nomeVeiculo = veiculoSelecionado ? veiculoSelecionado.textContent.toLowerCase() : Object.keys(dados_veiculos_novos.veiculos)[0];

        if (tbody && campoTotal && nomeVeiculo) {
            preencherTabelaMotoristas(nomeVeiculo);
        }

        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                <img src="imagens/sucesso.png" style="width: 30px; margin-right: 10px;">
                <label>Lista de motoristas atualizada com sucesso!</label>
            </div>
        `, 'Sucesso');

        setTimeout(() => {
            remover_popup();
        }, 500);

    } catch (error) {
        console.error('Erro ao atualizar lista:', error);
        removerOverlay();
        remover_popup();

        openPopup_v2(`
            <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                <img src="imagens/error.png" style="width: 30px; margin-right: 10px;">
                <label>Erro ao atualizar lista de motoristas. Tente novamente.</label>
            </div>
        `, 'Erro');
    }
}

async function atualizarDadosVeiculos() {
    try {
        await sincronizarDados('dados_veiculos', true);
        
        const container = document.getElementById('tabelaRegistro');
        if (container) {
            container.innerHTML = criarLayoutPrincipal();
            const filtro = container.querySelector('.veiculos-toolbar-filtro');
            const tbody = container.querySelector('#tabelaMotoristas');
            await botoesVeiculos(filtro, tbody);
        }

        removerOverlay();
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
        removerOverlay();
    }
}