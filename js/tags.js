class TagsPainel {

    constructor({ baseTags, idRef, baseRef, funcao }) {
        this.baseTags = baseTags
        this.idRef = idRef
        this.baseRef = baseRef
        this.funcao = funcao
    }

    isDark(cor) {
        const c = (cor || '#999').replace('#', '')
        const r = parseInt(c.substring(0, 2), 16)
        const g = parseInt(c.substring(2, 4), 16)
        const b = parseInt(c.substring(4, 6), 16)
        const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminancia < 0.5
    }

    async vincularTag(idTag) {
        const item = await recuperarDado(this.baseRef, this.idRef)
        item.tags ??= {}

        const tag = {
            data: new Date().toLocaleString(),
            usuario: acesso.usuario
        }

        item.tags[idTag] = tag

        enviar(`${this.baseRef}/${this.idRef}/tags/${idTag}`, tag)
        await inserirDados({ [this.idRef]: item }, this.baseRef)
        await this.painelTags()

        if (this.funcao) executar(this.funcao)
    }

    async gerarLabelsAtivas() {
        const tags = await recuperarDados(this.baseTags)
        const item = await recuperarDado(this.baseRef, this.idRef)
        const tagsAtivas = item?.tags || {}

        return Object.entries(tagsAtivas)
            .map(([idTagItem, dados]) => {
                const tag = tags?.[idTagItem] || {}
                const cor = tag.cor || '#999'
                const branco = this.isDark(cor) ? 'color:#fff;' : ''
                return `<span name="${idTagItem}" onclick="tagsPainel = new TagsPainel({ idRef: '${this.idRef}', baseRef: '${this.baseRef}'}); tagsPainel.confirmarRemoverTag('${idTagItem}')" title="${dados.usuario} - ${dados.data}" style="background-color: ${cor}; ${branco}" class="span-estiqueta">${tag.nome}</span>`
            })
            .join('')
    }

    async painelTags() {
        const tags = await recuperarDados(this.baseTags)
        const labelsAtivas = await this.gerarLabelsAtivas()

        const labels = Object.entries(tags)
            .map(([id, tag]) => {
                const cor = tag.cor || '#999'
                const branco = this.isDark(cor) ? 'color:#fff;' : ''
                return `<span onclick="tagsPainel.vincularTag('${id}')" style="background-color: ${cor}; ${branco}" class="span-estiqueta">${tag.nome}</span>`
            })
            .join('')

        const elementos = `
            <span>Disponíveis</span>
            <div class="etiquetas-organizadas">${labels}</div>

            <hr>
            <span>Ativos</span>
            <div class="etiquetas-organizadas">${labelsAtivas}</div>
        `

        const painel = document.querySelector('.painel-etiquetas')
        if (painel) return painel.innerHTML = elementos

        const acumulado = `
            <div class="painel-etiquetas">${elementos}</div>
            <div class="rodape-painel-clientes">
                ${botaoRodape(`tagsPainel.adicionarTag()`, 'Criar Etiqueta', 'etiqueta')}
            </div>
        `

        popup(acumulado, 'Gerenciar Tags', true)
    }

    confirmarRemoverTag(idTagItem) {
        const acumulado = `
            <div style="${horizontal}; gap: 1rem; background-color: #d2d2d2; padding: 1rem;">
                <span>Remover tag?</span>
                <button onclick="tagsPainel.removerTag('${idTagItem}')">
                    Confirmar
                </button>
            </div>
        `

        popup(acumulado, 'Tem certeza?', true)
    }

    async removerTag(idTagItem) {

        overlayAguarde()

        const item = await recuperarDado(this.baseRef, this.idRef)

        delete item.tags[idTagItem]

        deletar(`${this.baseRef}/${this.idRef}/tags/${idTagItem}`)

        await inserirDados({ [this.idRef]: item }, this.baseRef)

        removerPopup()

        const labels = document.querySelectorAll(`[name="${idTagItem}"]`)
        for (const label of labels) label.remove()
    }

    async adicionarTag(idTag = ID5digitos()) {
        const acumulado = `
            <div class="painel-adicionar-etiqueta">
                <input name="nome" placeholder="Nome tag">
                <input name="cor" type="color">
            </div>

            <div class="rodape-painel-clientes">
                ${botaoRodape(`tagsPainel.salvarTag('${idTag}')`, 'Salvar', 'concluido')}
            </div>
        `
        popup(acumulado, 'Tags', true)
    }

    async salvarTag(idTag) {
        overlayAguarde()

        const painel = document.querySelector('.painel-adicionar-etiqueta')
        const nome = painel.querySelector('[name="nome"]').value
        const cor = painel.querySelector('[name="cor"]').value

        if (!nome) return removerPopup()

        const etiqueta = { nome, cor }

        enviar(`${this.baseTags}/${idTag}`, etiqueta)
        await inserirDados({ [idTag]: etiqueta }, this.baseTags)

        removerPopup()
        await this.painelTags()
    }
}
