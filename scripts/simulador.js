let valor_compra = document.getElementById('valor_compra')
let porcentagem_margem = document.getElementById('porcentagem_margem')
let valor_margem = document.getElementById('valor_margem')
let margem_percentual = document.getElementById('margem_percentual')
let compra_mais_margem = document.getElementById('compra_mais_margem')
let icms_toggle = document.getElementById('icms_toggle')
let icms = document.getElementById('icms')
let valor_liquido = document.getElementById('valor_liquido')
let impostos_federais = document.getElementById('impostos_federais')
let custo_logistico = document.getElementById('custo_logistico')
let total_equipamento = document.getElementById('total_equipamento')
let total_equipamento_porcentagem = document.getElementById('total_equipamento_porcentagem')

let dados_simulador = JSON.parse(localStorage.getItem('dados_simulador'))

if (dados_simulador) {

    valor_compra.value = dados_simulador.valor
    porcentagem_margem.value = dados_simulador.margem
    icms_toggle.checked = dados_simulador.icms
    atualizarValores()

}

function atualizarValores() {

    let icms_taxa = icms_toggle.checked ? 0.12 : 0.205;

    valor_margem.textContent = dinheiro(Number(valor_compra.value) * porcentagem_margem.value / 100)
    margem_percentual.textContent = porcentagem_margem.value + '%'
    compra_mais_margem.textContent = dinheiro(Number(valor_compra.value) + conversor(valor_margem.textContent))

    let calculo_icms = conversor(compra_mais_margem.textContent) * icms_taxa
    icms.textContent = dinheiro(calculo_icms)

    valor_liquido.textContent = dinheiro(conversor(compra_mais_margem.textContent) - conversor(icms.textContent))

    let calculo_impostos_federais = conversor(compra_mais_margem.textContent) * 0.08
    impostos_federais.textContent = dinheiro(calculo_impostos_federais)

    let calculo_custo_logistico = conversor(compra_mais_margem.textContent) * 0.05
    custo_logistico.textContent = dinheiro(calculo_custo_logistico)

    let calculo_total_equipamento = conversor(compra_mais_margem.textContent) - Number(valor_compra.value) - calculo_icms - calculo_impostos_federais - calculo_custo_logistico
    total_equipamento.textContent = dinheiro(calculo_total_equipamento)

    let porcentagem_final = calculo_total_equipamento / conversor(compra_mais_margem.textContent) * 100

    if (calculo_total_equipamento == 0) {

        total_equipamento_porcentagem.textContent = 0 + ' %'

    } else {
        
        total_equipamento_porcentagem.textContent = porcentagem_final.toFixed(0) + ' %'

    }

    let dados_simulador = {

        valor: valor_compra.value,
        margem: porcentagem_margem.value,
        icms: icms_toggle.checked

    }

    localStorage.setItem('dados_simulador', JSON.stringify(dados_simulador))

}

valor_compra.addEventListener('input', atualizarValores)
porcentagem_margem.addEventListener('input', atualizarValores)
icms_toggle.addEventListener('change', atualizarValores)

function conversor(stringMonetario) {

    if (typeof stringMonetario === 'number') {

        return stringMonetario

    } else {

        stringMonetario = stringMonetario.trim();
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
        let valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {

            return 0;

        }

        return valorNumerico;

    }

}

function dinheiro(valor) {

    if (valor === '') {

        return 'R$ 0,00';

    } else {

        valor = Number(valor);
        return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    }
    
}