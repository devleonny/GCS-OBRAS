class formulario {

    constructor({ linhas, botoes, titulo }) {
        this.titulo = titulo || 'Formulário'
        this.linhas = linhas || []
        this.botoes = botoes || []
    }

    abrirFormulario() {

        const botaoPadrao = ({ funcao, img, texto }) => `
            <div onclick="${funcao}" class="botoes-rodape">
                <img src="imagens/${img}.png">
                <span>${texto}</span>
            </div>
        `

        const linhaFormulario = ({ texto, elemento }) => `
            <div class="linha-padrao">
                ${texto
                ? `<span style="text-align: left;">${texto}</span>`
                : ''}
                ${elemento}
            </div>
        `

        const linhas = this.linhas
            .map(l => linhaFormulario(l))
            .join('')

        const botoes = this.botoes
            .map(b => botaoPadrao(b))
            .join('')

        const acumulado = `
            <div class="painel-padrao">
                ${linhas}
            </div>
            <div class="rodape-padrao">
                ${botoes}
            </div>
        `

        popup(acumulado, this.titulo, true)

    }


}