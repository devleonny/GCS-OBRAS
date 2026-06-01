function garantirControlesDropdown(pag) {
    controles[pag] ??= {};
    controles[pag].filtros ??= {};
}

function regrasAtuaisDropdown(path, pag) {
    const atual = controles?.[pag]?.filtros?.[path];
    if (!atual) return [];
    return Array.isArray(atual) ? [...atual] : [atual];
}

function valoresMarcadosDropdown(path, pag) {
    const atual = regrasAtuaisDropdown(path, pag);
    const grupo = atual.find(r => r?.modo === 'OR' && r?.origem === 'dropdown');
    return (grupo?.regras || []).map(r => r.value);
}

function opcoesDropdownValidas(opcoes = []) {
    return opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => String(a).localeCompare(String(b)));
}

function tudoMarcadoDropdown(path, opcoes = [], pag) {
    const validas = opcoesDropdownValidas(opcoes);
    const marcados = valoresMarcadosDropdown(path, pag);

    // Sem filtro = todas visualmente marcadas
    if (validas.length > 0 && marcados.length === 0) return true;

    return validas.length > 0 && validas.every(o => marcados.includes(o));
}

function labelDropdown(path, pag, opcoes = []) {
    const marcados = valoresMarcadosDropdown(path, pag);
    const total = opcoesDropdownValidas(opcoes).length;

    if (marcados.length === 0 || (total > 0 && marcados.length === total)) {
        return 'Selecionar';
    }

    if (marcados.length === 1) return marcados[0];
    return `${marcados.length} selecionados`;
}

function getDropdownSeletor(path, pag) {
    return `.filtro-dropdown[data-path="${CSS.escape(path)}"][data-pag="${CSS.escape(pag)}"]`;
}

function atualizarLabelDropdown(path, pag) {
    const drop = document.querySelector(getDropdownSeletor(path, pag));
    if (!drop) return;

    const label = drop.querySelector('.dropdown-label');
    if (!label) return;

    const opcoes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')]
        .map(input => input.value);

    label.textContent = labelDropdown(path, pag, opcoes);
}

async function executarAcaoDropdown(funcao = null, pag = null) {
    if (funcao && typeof window[funcao] === 'function') {
        await window[funcao]();
        return;
    }

    if (pag) {
        await paginacao(pag);
        return;
    }

    await paginacao();
}

async function alternarTodosDropdown(path, opcoes = [], pag, funcao = null) {
    garantirControlesDropdown(pag);

    const regras = regrasAtuaisDropdown(path, pag);
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'));
    const validas = opcoesDropdownValidas(opcoes);

    if (validas.length === 0) return;

    const atualmenteTudoMarcado = tudoMarcadoDropdown(path, validas, pag);

    if (atualmenteTudoMarcado) {
        // Desmarca tudo visualmente e remove filtro
        if (outrasRegras.length === 0) {
            delete controles[pag].filtros[path];
        } else if (outrasRegras.length === 1) {
            controles[pag].filtros[path] = outrasRegras[0];
        } else {
            controles[pag].filtros[path] = outrasRegras;
        }

        const drop = document.querySelector(getDropdownSeletor(path, pag));
        if (drop) {
            drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]').forEach(input => {
                input.checked = false;
            });

            const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');
            if (checkTodos) checkTodos.checked = false;
        }
    } else {
        // Marca tudo visualmente, mas continua SEM filtro salvo
        if (outrasRegras.length === 0) {
            delete controles[pag].filtros[path];
        } else if (outrasRegras.length === 1) {
            controles[pag].filtros[path] = outrasRegras[0];
        } else {
            controles[pag].filtros[path] = outrasRegras;
        }

        const drop = document.querySelector(getDropdownSeletor(path, pag));
        if (drop) {
            drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]').forEach(input => {
                input.checked = true;
            });

            const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');
            if (checkTodos) checkTodos.checked = true;
        }
    }

    if (controles[pag]?.filtros && Object.keys(controles[pag].filtros).length === 0) {
        delete controles[pag].filtros;
    }

    atualizarLabelDropdown(path, pag);
    await executarAcaoDropdown(funcao, pag);
}

async function alternarFiltroDropdown(marcado, strg) {
    const {
        path,
        valor,
        pag,
        funcao = null,
        op
    } = JSON.parse(decodeURIComponent(strg));

    garantirControlesDropdown(pag);

    const regras = regrasAtuaisDropdown(path, pag);
    const grupoAtual = regras.find(r => r?.modo === 'OR' && r?.origem === 'dropdown');
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'));

    const drop = document.querySelector(getDropdownSeletor(path, pag));
    const opcoes = drop
        ? [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')].map(input => input.value)
        : [];

    const validas = opcoesDropdownValidas(opcoes);

    let regrasDropdown = [...(grupoAtual?.regras || [])]
        .filter(r => r.value !== valor);

    if (marcado) {
        regrasDropdown.push({
            op,
            value: valor
        });
    }

    const valoresSelecionados = regrasDropdown.map(r => r.value);
    const selecionouTodas = validas.length > 0 && validas.every(v => valoresSelecionados.includes(v));

    // Se marcou tudo, vira "sem filtro"
    if (regrasDropdown.length > 0 && !selecionouTodas) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: regrasDropdown
        });
    }

    if (outrasRegras.length === 0) {
        delete controles[pag].filtros[path];
    } else if (outrasRegras.length === 1) {
        controles[pag].filtros[path] = outrasRegras[0];
    } else {
        controles[pag].filtros[path] = outrasRegras;
    }

    if (controles[pag]?.filtros && Object.keys(controles[pag].filtros).length === 0) {
        delete controles[pag].filtros;
    }

    if (drop) {
        const checkboxes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')];
        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');

        if (selecionouTodas) {
            checkboxes.forEach(input => {
                input.checked = true;
            });
        }

        if (checkTodos) {
            checkTodos.checked = tudoMarcadoDropdown(path, validas, pag);
        }
    }

    atualizarLabelDropdown(path, pag);
    await executarAcaoDropdown(funcao, pag);
}

function fecharTodosDropdowns() {
    document.querySelectorAll('.filtro-dropdown .dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
        menu.dataset.aberto = 'N';
    });
}

function toggleDropdown(botao) {
    const drop = botao.closest('.filtro-dropdown');
    const menu = drop?.querySelector('.dropdown-menu');
    if (!menu) return;

    const aberto = menu.dataset.aberto === 'S';

    fecharTodosDropdowns();

    if (!aberto) {
        menu.style.display = 'block';
        menu.dataset.aberto = 'S';
    }
}

function montarDropdownCheckbox({ titulo, op = '=', pag, funcao = null, path, opcoes = [] }) {
    const validas = opcoesDropdownValidas(opcoes);
    const marcados = valoresMarcadosDropdown(path, pag);
    const todosAtivos = tudoMarcadoDropdown(path, validas, pag);

    const itens = validas.map(o => {
        const dados = {
            op,
            path,
            valor: o,
            pag,
            funcao
        };

        const checked = todosAtivos || marcados.includes(o);

        return `
        <label class="dropdown-item">
            <input
                type="checkbox"
                data-item="opcao"
                value="${String(o).replace(/"/g, '&quot;')}"
                ${checked ? 'checked' : ''}
                onchange="alternarFiltroDropdown(this.checked, '${encodeURIComponent(JSON.stringify(dados))}')">
            <span>${o}</span>
        </label>
        `;
    }).join('');

    return `
        <div class="campo-pesquisa">
            <span style="color: white;">${titulo}</span>
            <div class="filtro-dropdown" data-path="${path}" data-pag="${pag}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <span class="dropdown-label">${labelDropdown(path, pag, validas)}</span>
                    <span>▾</span>
                </div>
                <div class="dropdown-menu" data-aberto="N">
                    <label class="dropdown-item" style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px;">
                        <input
                            type="checkbox"
                            data-item="todos"
                            ${todosAtivos ? 'checked' : ''}
                            onchange="alternarTodosDropdown('${path.replace(/'/g, "\\'")}', ${JSON.stringify(validas).replace(/"/g, '&quot;')}, '${pag.replace(/'/g, "\\'")}'${funcao ? `, '${funcao.replace(/'/g, "\\'")}'` : ''})">
                        <span>Todos</span>
                    </label>

                    ${itens || '<span>Nenhuma opção</span>'}
                </div>
            </div>
        </div>
    `;
}