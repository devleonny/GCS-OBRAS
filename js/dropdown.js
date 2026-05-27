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

    return validas.length > 0 && validas.every(o => marcados.includes(o));
}

function labelDropdown(path, pag) {
    const marcados = valoresMarcadosDropdown(path, pag);

    if (marcados.length === 0) return 'Selecionar';
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

    label.textContent = labelDropdown(path, pag);
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

    const marcarTudo = !tudoMarcadoDropdown(path, validas, pag);

    if (marcarTudo) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: validas.map(value => ({
                op: '=',
                value
            }))
        });
    }

    if (outrasRegras.length === 0) {
        delete controles[pag].filtros[path];
    } else if (outrasRegras.length === 1) {
        controles[pag].filtros[path] = outrasRegras[0];
    } else {
        controles[pag].filtros[path] = outrasRegras;
    }

    if (Object.keys(controles[pag].filtros).length === 0) {
        delete controles[pag].filtros;
    }

    const drop = document.querySelector(getDropdownSeletor(path, pag));
    if (drop) {
        const checks = drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]');
        checks.forEach(input => {
            input.checked = marcarTudo;
        });

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');
        if (checkTodos) {
            checkTodos.checked = marcarTudo;
        }
    }

    atualizarLabelDropdown(path, pag);
    await executarAcaoDropdown(funcao, pag);
}

async function alternarFiltroDropdown(path, valor, marcado, pag, funcao = null) {
    garantirControlesDropdown(pag);

    const regras = regrasAtuaisDropdown(path, pag);
    const grupoAtual = regras.find(r => r?.modo === 'OR' && r?.origem === 'dropdown');
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'));

    let regrasDropdown = [...(grupoAtual?.regras || [])]
        .filter(r => r.value !== valor);

    if (marcado) {
        regrasDropdown.push({
            op: 'includes',
            value: valor
        });
    }

    if (regrasDropdown.length > 0) {
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

    if (Object.keys(controles[pag].filtros).length === 0) {
        delete controles[pag].filtros;
    }

    const drop = document.querySelector(getDropdownSeletor(path, pag));
    if (drop) {
        const opcoes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')]
            .map(input => input.value);

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]');
        if (checkTodos) {
            checkTodos.checked = tudoMarcadoDropdown(path, opcoes, pag);
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

function montarDropdownCheckbox({ titulo, pag, funcao = null, path, opcoes = [] }) {
    const validas = opcoesDropdownValidas(opcoes);
    const marcados = valoresMarcadosDropdown(path, pag);
    const todosAtivos = tudoMarcadoDropdown(path, validas, pag);

    const itens = validas.map(o => `
        <label class="dropdown-item">
            <input
                type="checkbox"
                data-item="opcao"
                value="${String(o).replace(/"/g, '&quot;')}"
                ${marcados.includes(o) ? 'checked' : ''}
                onchange="alternarFiltroDropdown('${path.replace(/'/g, "\\'")}', ${JSON.stringify(o).replace(/"/g, '&quot;')}, this.checked, '${pag.replace(/'/g, "\\'")}'${funcao ? `, '${funcao.replace(/'/g, "\\'")}'` : ''})">
            <span>${o}</span>
        </label>
    `).join('');

    return `
        <div class="campo-pesquisa">
            <span style="color: white;">${titulo}</span>
            <div class="filtro-dropdown" data-path="${path}" data-pag="${pag}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <span class="dropdown-label">${labelDropdown(path, pag)}</span>
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