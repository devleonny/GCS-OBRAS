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
                <button class="botao-remover-veiculo" onclick="abrirGerenciamentoFrotas()">
                    Remover Veículo/Frota
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
                            <th>Custos Extras</th>
                            <th>Ação</th>
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

async function adicionarCustoExtra(idMotorista, nomeVeiculo) {
    const valor = Number(document.getElementById('valor_extra').value) || 0;
    const descricao = document.getElementById('descricao_extra').value;

    if (!valor || !descricao) {
        openPopup_v2('Por favor, preencha todos os campos', 'Campos Obrigatórios', true);
        return;
    }

    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        if (!motorista.custos_extras) {
            motorista.custos_extras = { registros: {} };
        }

        const idRegistro = gerar_id_5_digitos();
        motorista.custos_extras.registros[idRegistro] = {
            data: data_atual('curta'),
            valor: valor,
            descricao: descricao
        };

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupExtras(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao adicionar custo extra:', error);
        openPopup_v2('Erro ao adicionar custo extra. Tente novamente.', 'Erro');
    }
}

async function editarCustoExtra(idMotorista, nomeVeiculo, idRegistro) {
    try {
        const dados_veiculos = await recuperarDados('dados_veiculos');
        const registro = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista].custos_extras.registros[idRegistro];

        const conteudo = `
            <div class="popup-edit-container">
                <h3>Editar Custo Extra</h3>
                
                <div class="form-edit-campos">
                    <div class="campo-edit-grupo">
                        <label for="edit_data">Data</label>
                        <input type="date" id="edit_data" value="${formatarDataParaInput(registro.data)}">
                    </div>

                    <div class="campo-edit-grupo">
                        <label for="edit_valor">Valor</label>
                        <input type="number" id="edit_valor" value="${registro.valor}" step="0.01" min="0">
                    </div>

                    <div class="campo-edit-grupo">
                        <label for="edit_descricao">Descrição</label>
                        <textarea id="edit_descricao" rows="3">${registro.descricao}</textarea>
                    </div>

                    <div class="campo-edit-grupo">
                        <button onclick="salvarEdicaoCustoExtra('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" class="botao-form primario">
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        `;

        openPopup_v2(conteudo, 'Editar Custo Extra', true);

    } catch (error) {
        console.error('Erro ao abrir formulário de edição:', error);
        openPopup_v2('Erro ao abrir formulário. Tente novamente.', 'Erro');
    }
}

async function salvarEdicaoCustoExtra(idMotorista, nomeVeiculo, idRegistro) {
    try {
        const valor = Number(document.getElementById('edit_valor').value) || 0;
        const descricao = document.getElementById('edit_descricao').value;
        const data = document.getElementById('edit_data').value;

        if (!valor || !descricao) {
            openPopup_v2('Por favor, preencha todos os campos', 'Campos Obrigatórios', true);
            return;
        }

        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        motorista.custos_extras.registros[idRegistro] = {
            data: formatarData(data),
            valor: valor,
            descricao: descricao
        };

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupExtras(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao salvar alterações:', error);
        openPopup_v2('Erro ao salvar alterações. Tente novamente.', 'Erro');
    }
}

async function excluirCustoExtra(idMotorista, nomeVeiculo, idRegistro) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        delete motorista.custos_extras.registros[idRegistro];

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupExtras(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao excluir custo extra:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao excluir custo extra. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

function criarLinhaMotorista(motorista, idMotorista, nomeVeiculo) {
    const custos = motorista.custo_mensal_veiculo?.custos || {};
    const totalCustos = Object.values(custos).reduce((total, item) => total + (Number(item.custo) || 0), 0);

    const combustivel = motorista.combustivel || {};
    const pedagio = motorista.pedagio || {};
    const estacionamento = motorista.estacionamento || {};
    const extras = motorista.custos_extras || {};

    const dadosVeiculo = encodeURIComponent(JSON.stringify(motorista.dados_veiculo));

    return `
        <tr>
            <td>${motorista.nome || ''}</td>
            <td>
                <button class="botao-dados-veiculo" onclick="mostrarDadosVeiculo('${dadosVeiculo}')">
                    Ver Dados do Veículo
                </button>
            </td>
            <td>
                <button class="botao-custos" onclick="abrirPopupCustos('${idMotorista}', '${nomeVeiculo}', '${motorista.nome}')">
                    ${totalCustos > 0 ? dinheiro(totalCustos) : 'Adicionar Custos'}
                </button>
            </td>
            <td>
                <button class="botao-combustivel" onclick="abrirPopupCombustivel('${idMotorista}', '${nomeVeiculo}', '${motorista.nome}')">
                    ${combustivel.registros ? 'Ver Registros' : 'Registrar Combustível'}
                </button>
            </td>
            <td>${pedagio.tag || ''}</td>
            <td>${estacionamento.tag || ''}</td>
            <td>
                <button class="botao-custos" onclick="abrirPopupExtras('${idMotorista}', '${nomeVeiculo}', '${motorista.nome}')">
                    ${extras.registros ? 'Ver Registros' : 'Registrar Custos'}
                </button>
            </td>
            <td style="text-align: center;">
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

async function abrirPopupCombustivel(idMotorista, nomeVeiculo, nomeMotorista) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        
        if (!dados_veiculos?.veiculos?.[nomeVeiculo]?.motoristas?.[idMotorista]) {
            throw new Error('Motorista não encontrado');
        }

        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        if (!motorista.combustivel) {
            motorista.combustivel = { registros: {} };
        }

        const registros = motorista.combustivel.registros;
        const totalLitros = Object.values(registros).reduce((total, reg) => total + (Number(reg.litros) || 0), 0);
        const totalCusto = Object.values(registros).reduce((total, reg) => total + (Number(reg.custo_total) || 0), 0);
        const totalKm = Object.values(registros).reduce((total, reg) => total + (Number(reg.km) || 0), 0);
        
        const conteudo = `
            <div class="custos-container">
                <h3>Registros de Combustível - ${nomeMotorista}</h3>
                
                <div class="form-grupo form-custos">
                    <div class="form-combustivel-campos">
                        <div class="campo-grupo">
                            <label for="km">KM</label>
                            <input type="number" id="km" placeholder="Quilometragem" step="1" min="0">
                        </div>

                        <div class="campo-grupo">
                            <label for="litros">Litros</label>
                            <input type="number" id="litros" placeholder="Quantidade de litros" step="0.01" min="0" oninput="calcularCustoTotal()">
                        </div>

                        <div class="campo-grupo">
                            <label for="custo_litro">Custo/Litro</label>
                            <input type="number" id="custo_litro" placeholder="Custo por litro" step="0.01" min="0" oninput="calcularCustoTotal()">
                        </div>

                        <div class="campo-grupo">
                            <label for="custo_total">Custo total</label>
                            <input type="number" id="custo_total" placeholder="Custo total" step="0.01" min="0">
                        </div>
                    </div>

                    <button onclick="adicionarRegistroCombustivel('${idMotorista}', '${nomeVeiculo}')" class="botao-form primario">
                        Adicionar Registro
                    </button>
                </div>

                <table class="tabela">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>KM</th>
                            <th>Litros</th>
                            <th>Custo/Litro</th>
                            <th>Total</th>
                            <th>Anexos</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="lista-registros">
                        ${Object.entries(registros).map(([idRegistro, registro]) => `
                            <tr>
                                <td>${registro.data}</td>
                                <td>${registro.km || 0}</td>
                                <td>${registro.litros}</td>
                                <td>${dinheiro(registro.custo_litro)}</td>
                                <td>${dinheiro(registro.custo_total)}</td>
                                <td>
                                    <button class="botao-anexos" onclick="abrirAnexosCombustivel('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')">
                                        Anexar PDF
                                    </button>
                                </td>
                                <td>
                                    <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" onclick="editarRegistroCombustivel('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" title="Editar registro">
                                    <img src="imagens/excluir.png" style="width: 2vw; cursor: pointer;" onclick="excluirRegistroCombustivel('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" title="Excluir registro">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Total:</strong></td>
                            <td><strong>${totalKm.toFixed(0)} KM</strong></td>
                            <td><strong>${totalLitros.toFixed(2)}L</strong></td>
                            <td></td>
                            <td><strong>${dinheiro(totalCusto)}</strong></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        openPopup_v2(conteudo, 'Registros de Combustível');

    } catch (error) {
        console.error('Erro ao abrir popup de combustível:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao carregar registros. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function abrirPopupExtras(idMotorista, nomeVeiculo, nomeMotorista) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        const extras = motorista.custos_extras || {};

        const conteudo = `
            <div class="custos-container">
                <h3>Custos Extras - ${nomeMotorista}</h3>
                
                <div class="form-grupo form-custos">
                    <div class="form-extras-campos">
                        <div class="extras-grupo">
                            <label for="valor_extra">Valor</label>
                            <input type="number" id="valor_extra" placeholder="Valor do custo" step="0.01" min="0">
                        </div>

                        <div class="extras-grupo">
                            <label for="descricao_extra">Descrição</label>
                            <textarea id="descricao_extra" placeholder="Descreva o custo extra"></textarea>
                        </div>
                    </div>

                    <button onclick="adicionarCustoExtra('${idMotorista}', '${nomeVeiculo}')" class="botao-form primario">
                        Adicionar Custo Extra
                    </button>
                </div>

                <table class="tabela">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Valor</th>
                            <th>Descrição</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(extras.registros || {}).map(([idRegistro, registro]) => `
                            <tr>
                                <td>${registro.data}</td>
                                <td>${dinheiro(registro.valor)}</td>
                                <td>${registro.descricao}</td>
                                <td>
                                    <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" onclick="editarCustoExtra('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" title="Editar registro">
                                    <img src="imagens/excluir.png" style="width: 2vw; cursor: pointer;" onclick="excluirCustoExtra('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" title="Excluir registro">
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td><strong>Total:</strong></td>
                            <td colspan="3"><strong>${dinheiro(Object.values(extras.registros || {}).reduce((total, reg) => total + (Number(reg.valor) || 0), 0))}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        openPopup_v2(conteudo, 'Custos Extras');

    } catch (error) {
        console.error('Erro ao abrir popup de custos extras:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao carregar custos extras. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

function calcularCustoTotal() {
    const litros = Number(document.getElementById('litros').value) || 0;
    const custoLitro = Number(document.getElementById('custo_litro').value) || 0;
    const custoTotalInput = document.getElementById('custo_total');
    
    if (!custoTotalInput.dataset.manuallyEdited) {
        custoTotalInput.value = (litros * custoLitro).toFixed(2);
    }
}

async function editarRegistroCombustivel(idMotorista, nomeVeiculo, idRegistro) {
    try {
        const dados_veiculos = await recuperarDados('dados_veiculos');
        const registro = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista].combustivel.registros[idRegistro];

        const conteudo = `
            <div class="form-grupo form-custos">
                <h3>Editar Registro de Combustível</h3>
                
                <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                    <div class="form-grupo">
                        <label>Data:</label>
                        <input type="date" id="edit_data" value="${formatarDataParaInput(registro.data)}">
                    </div>

                    <div class="form-grupo">
                        <label>Quilometragem:</label>
                        <input type="number" id="edit_km" value="${registro.km || 0}" step="1" min="0">
                    </div>

                    <div class="form-grupo">
                        <label>Litros:</label>
                        <input type="number" id="edit_litros" value="${registro.litros}" step="0.01" min="0" oninput="calcularCustoTotalEdicao()">
                    </div>

                    <div class="form-grupo">
                        <label>Custo por Litro:</label>
                        <input type="number" id="edit_custo_litro" value="${registro.custo_litro}" step="0.01" min="0" oninput="calcularCustoTotalEdicao()">
                    </div>

                    <div class="form-grupo">
                        <label>Custo Total:</label>
                        <input type="number" id="edit_custo_total" value="${registro.custo_total}" step="0.01" min="0">
                    </div>
                </div>

                <button onclick="salvarEdicaoRegistroCombustivel('${idMotorista}', '${nomeVeiculo}', '${idRegistro}')" class="botao-form primario">
                    Salvar Alterações
                </button>
            </div>
        `;

        openPopup_v2(conteudo, 'Editar Registro', true);
    } catch (error) {
        console.error('Erro ao abrir formulário de edição:', error);
        openPopup_v2('Erro ao abrir formulário. Tente novamente.', 'Erro');
    }
}

function formatarDataParaInput(data) {
    const [dia, mes, ano] = data.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function calcularCustoTotalEdicao() {
    const litros = Number(document.getElementById('edit_litros').value) || 0;
    const custoLitro = Number(document.getElementById('edit_custo_litro').value) || 0;
    const custoTotalInput = document.getElementById('edit_custo_total');
    
    if (!custoTotalInput.dataset.manuallyEdited) {
        custoTotalInput.value = (litros * custoLitro).toFixed(2);
    }
}

async function salvarEdicaoRegistroCombustivel(idMotorista, nomeVeiculo, idRegistro) {
    try {
        const litros = Number(document.getElementById('edit_litros').value) || 0;
        const custoLitro = Number(document.getElementById('edit_custo_litro').value) || 0;
        const custoTotal = Number(document.getElementById('edit_custo_total').value) || 0;
        const km = Number(document.getElementById('edit_km').value) || 0;
        const data = document.getElementById('edit_data').value;

        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        motorista.combustivel.registros[idRegistro].data = formatarData(data);
        motorista.combustivel.registros[idRegistro].km = km;
        motorista.combustivel.registros[idRegistro].litros = litros;
        motorista.combustivel.registros[idRegistro].custo_litro = custoLitro;
        motorista.combustivel.registros[idRegistro].custo_total = custoTotal;

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupCombustivel(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao salvar alterações:', error);
        openPopup_v2('Erro ao salvar alterações. Tente novamente.', 'Erro');
    }
}

function formatarData(data) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

async function adicionarRegistroCombustivel(idMotorista, nomeVeiculo) {
    const litros = Number(document.getElementById('litros').value) || 0;
    const custoLitro = Number(document.getElementById('custo_litro').value) || 0;
    const custoTotal = Number(document.getElementById('custo_total').value) || 0;
    const km = Number(document.getElementById('km').value) || 0;

    try {
        let dados_veiculos = await recuperarDados('dados_veiculos') || { veiculos: {} };
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        if (!motorista.combustivel) {
            motorista.combustivel = { registros: {} };
        }

        const idRegistro = gerar_id_5_digitos();
        motorista.combustivel.registros[idRegistro] = {
            data: data_atual('curta'),
            km: km,
            litros,
            custo_litro: custoLitro,
            custo_total: custoTotal,
            anexos: {}
        };

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupCombustivel(idMotorista, nomeVeiculo, motorista.nome);
    } catch (error) {
        console.error('Erro ao adicionar registro:', error);
        openPopup_v2('Erro ao adicionar registro. Tente novamente.', 'Erro');
    }
}

async function salvarAnexoCombustivel(input, idMotorista, nomeVeiculo, idRegistro) {
    try {
        if (!input.files || !input.files[0]) {
            throw new Error('Nenhum arquivo selecionado');
        }

        const anexos = await anexo_v2(input);
        if (!anexos || anexos.length === 0) {
            throw new Error('Erro ao fazer upload do arquivo');
        }

        let dados_veiculos = await recuperarDados('dados_veiculos');
        if (!dados_veiculos?.veiculos?.[nomeVeiculo]?.motoristas?.[idMotorista]) {
            throw new Error('Motorista não encontrado');
        }

        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];

        if (!motorista.combustivel) {
            motorista.combustivel = { registros: {} };
        }

        if (idRegistro) {
            if (!motorista.combustivel.registros[idRegistro]) {
                throw new Error('Registro não encontrado');
            }

            if (!motorista.combustivel.registros[idRegistro].anexos) {
                motorista.combustivel.registros[idRegistro].anexos = {};
            }

            anexos.forEach(anexo => {
                const idAnexo = gerar_id_5_digitos();
                motorista.combustivel.registros[idRegistro].anexos[idAnexo] = {
                    nome: anexo.nome,
                    formato: anexo.tipo || 'application/pdf',
                    link: anexo.link
                };
            });

            await inserirDados(dados_veiculos, 'dados_veiculos');
            await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

            remover_popup();
            abrirAnexosCombustivel(idMotorista, nomeVeiculo, idRegistro);
        }

    } catch (error) {
        console.error('Erro ao salvar anexo:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao salvar anexo: ${error.message}</p>
            </div>
        `, 'Erro');
    }
}

async function abrirAnexosCombustivel(idMotorista, nomeVeiculo, idRegistro) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const registro = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista].combustivel.registros[idRegistro];
        const anexos = registro.anexos || {};

        const conteudo = `
            <div class="anexos-container">
                <h3>Anexos do Registro</h3>
                
                <div id="container_anexos_combustivel">
                    ${Object.entries(anexos).map(([idAnexo, anexo]) => `
                        <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 5px; background-color: #222; padding: 5px;">
                            <div onclick="abrirArquivo('${anexo.link}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer;">
                                <img src="imagens/anexo2.png" style="width: 2vw;">
                                <label style="color: white; font-size: 0.8vw;">${anexo.nome.substring(0, 10)}${anexo.nome.length > 10 ? '...' : ''}</label>
                            </div>
                            <img src="imagens/excluir.png" 
                                style="width: 1.5vw; cursor: pointer;" 
                                onclick="excluirAnexoCombustivel('${idMotorista}', '${nomeVeiculo}', '${idRegistro}', '${idAnexo}')" 
                                title="Excluir anexo">
                        </div>
                    `).join('')}
                </div>

                <div class="form-grupo">
                    <label for="novo_anexo" class="anexo-label">
                        Adicionar Novo Anexo
                        <input type="file" 
                            id="novo_anexo" 
                            style="display: none;" 
                            onchange="salvarAnexoCombustivel(this, '${idMotorista}', '${nomeVeiculo}', '${idRegistro}')">
                    </label>
                </div>
            </div>
        `;

        openPopup_v2(conteudo, 'Anexos do Registro', true);

    } catch (error) {
        console.error('Erro ao abrir anexos:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao abrir anexos. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function excluirAnexoCombustivel(idMotorista, nomeVeiculo, idRegistro, idAnexo) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const registro = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista].combustivel.registros[idRegistro];
        
        // Delete file from server
        const link = registro.anexos[idAnexo].link;
        deletar_arquivo_servidor(link);
        
        // Delete reference from data
        delete registro.anexos[idAnexo];

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista]);

        abrirAnexosCombustivel(idMotorista, nomeVeiculo, idRegistro);

    } catch (error) {
        console.error('Erro ao excluir anexo:', error);
        openPopup_v2('Erro ao excluir anexo. Tente novamente.', 'Erro');
    }
}

async function excluirRegistroCombustivel(idMotorista, nomeVeiculo, idRegistro) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const motorista = dados_veiculos.veiculos[nomeVeiculo].motoristas[idMotorista];
        
        // Excluir anexos do servidor
        const anexos = motorista.combustivel.registros[idRegistro].anexos || {};
        for (let idAnexo in anexos) {
            await deletar(`uploads/${anexos[idAnexo].link}`);
        }

        delete motorista.combustivel.registros[idRegistro];

        await inserirDados(dados_veiculos, 'dados_veiculos');
        await enviar(`dados_veiculos/veiculos/${nomeVeiculo}/motoristas/${idMotorista}`, motorista);

        remover_popup();
        abrirPopupCombustivel(idMotorista, nomeVeiculo, motorista.nome);

    } catch (error) {
        console.error('Erro ao excluir registro:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao excluir registro. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function excluirFrota(nomeVeiculo, placa) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        
        delete dados_veiculos.veiculos[nomeVeiculo].frotas[placa];

        // Check if vehicle should be deleted
        const veiculoVazio = Object.keys(dados_veiculos.veiculos[nomeVeiculo].frotas).length === 0;
        
        if (veiculoVazio) {
            delete dados_veiculos.veiculos[nomeVeiculo];
            await deletar(`dados_veiculos/veiculos/${nomeVeiculo}`);
        } else {
            await deletar(`dados_veiculos/veiculos/${nomeVeiculo}/frotas/${placa}`);
        }

        await inserirDados(dados_veiculos, 'dados_veiculos');
        
        remover_popup();
        abrirGerenciamentoFrotas();

        // Show appropriate success message
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/sucesso.png">
                <label>${veiculoVazio ? 
                    `Frota e veículo ${nomeVeiculo.toUpperCase()} removidos com sucesso!` : 
                    'Frota removida com sucesso!'}</label>
            </div>
        `, 'Sucesso');

        if (veiculoVazio) {
            const container = document.getElementById('tabelaRegistro');
            if (container) {
                container.innerHTML = criarLayoutPrincipal();
                const filtro = container.querySelector('.veiculos-toolbar-filtro');
                const tbody = container.querySelector('#tabelaMotoristas');
                await botoesVeiculos(filtro, tbody);
            }
        }

        setTimeout(() => {
            remover_popup();
        }, 1500);

    } catch (error) {
        console.error('Erro ao excluir frota:', error);
        openPopup_v2(`
            <div class="popup-message">
                <img src="imagens/error.png">
                <p>Erro ao excluir frota. Tente novamente.</p>
            </div>
        `, 'Erro');
    }
}

async function tentarExcluirFrota(nomeVeiculo, placa) {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        const veiculo = dados_veiculos.veiculos[nomeVeiculo];
        
        const motoristasUsandoFrota = Object.entries(veiculo.motoristas || {})
            .filter(([_, motorista]) => motorista.dados_veiculo.placa === placa);

        if (motoristasUsandoFrota.length > 0) {
            const listaMotoristas = motoristasUsandoFrota
                .map(([_, motorista]) => motorista.nome)
                .join('</li><li>');

            openPopup_v2(`
                <div class="aviso-exclusao">
                    <img src="imagens/error.png" style="width: 30px;">
                    <h4>Não é possível excluir esta frota</h4>
                    <p>Os seguintes motoristas estão utilizando este veículo:</p>
                    <ul>
                        <li>${listaMotoristas}</li>
                    </ul>
                    <p>Remova os motoristas primeiro para poder excluir a frota.</p>
                    <button onclick="remover_popup()" class="botao-form primario">
                        Entendi
                    </button>
                </div>
            `, 'Aviso');
            return;
        }

        openPopup_v2(`
            <div class="confirmar-exclusao-container">
                <img src="gifs/alerta.gif" class="confirmar-exclusao-imagem">
                <p>Tem certeza que deseja excluir a frota ${placa} do veículo ${nomeVeiculo}?</p>
                <div class="confirmar-exclusao-botoes">
                    <button onclick="remover_popup()" class="botao-cancelar">
                        Cancelar
                    </button>
                    <button onclick="excluirFrota('${nomeVeiculo}', '${placa}')" class="botao-confirmar-exclusao">
                        Confirmar Exclusão
                    </button>
                </div>
            </div>
        `, 'Confirmar Exclusão');

    } catch (error) {
        console.error('Erro ao verificar frota:', error);
        openPopup_v2('Erro ao verificar dados. Tente novamente.', 'Erro');
    }
}

async function abrirGerenciamentoFrotas() {
    try {
        let dados_veiculos = await recuperarDados('dados_veiculos');
        let tabelasHtml = '';

        for (let nomeVeiculo in dados_veiculos.veiculos) {
            if (nomeVeiculo === 'timestamp') continue;

            const veiculo = dados_veiculos.veiculos[nomeVeiculo];
            const frotas = veiculo.frotas || {};
            
            tabelasHtml += `
                <div class="frota-container">
                    <h3>${nomeVeiculo.toUpperCase()}</h3>
                    <table class="tabela">
                        <thead>
                            <tr>
                                <th>Placa</th>
                                <th>Modelo</th>
                                <th>Status</th>
                                <th>Motoristas</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(frotas).map(([placa, frota]) => {
                                const motoristasUsandoFrota = Object.values(veiculo.motoristas || {})
                                    .filter(m => m.dados_veiculo.placa === placa);
                                
                                return `
                                    <tr>
                                        <td>${placa}</td>
                                        <td>${frota.modelo}</td>
                                        <td>${frota.status}</td>
                                        <td>${motoristasUsandoFrota.length}</td>
                                        <td>
                                            <button onclick="tentarExcluirFrota('${nomeVeiculo}', '${placa}')" 
                                                    class="botao-excluir-frota">
                                                Excluir Frota
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const conteudo = `
            <div class="gerenciamento-frotas">
                ${tabelasHtml}
            </div>
        `;

        openPopup_v2(conteudo, 'Gerenciamento de Frotas');

    } catch (error) {
        console.error('Erro ao abrir gerenciamento:', error);
        openPopup_v2('Erro ao carregar dados. Tente novamente.', 'Erro');
    }
}