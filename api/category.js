module.exports = app => {

    const { existsOrError, notExistsOrError, equalsOrError } = app.api.validations

    const save = (req, res) => {
        const category = { ...req.body }
        if(req.params.id) category.id = req.params.id

        try {
            existsOrError(category.name, 'Nome não informado')
        }
        catch(msg) {
            return res.status(400).send(msg)
        }

        if(category.id) {
            app.db('categories')
                .update(category)
                .where({ id: category.id })
                .then(_ => res.status(204).send())
                .catch(err => res.status(500).send())
        } else {
            app.db('categories')
                .insert(category)
                .then(_ => res.status(204).send())
                .catch(err => res.status(500).send())
        }
    }

    const remove = async(req, res) => {
        try {
            existsOrError(req.params.id, 'Código da categoria não informado.')

            const subcategory = await app.db('categories')
                .where({ parentId: req.params.id })
            notExistsOrError(subcategory, 'Categoria não possui subcategorias')

            const articles = await app.db('articles')
                .where({ categoryId: req.params.id })
            notExistsOrError(articles, 'Categoria não possui artigos')

            const rowsDeleted = await app.db('categories')
                .where({ id: req.params.id }).del()
            existsOrError(rowsDeleted, 'Categoria não foi encontrada.')

            res.status(204).send()
        } catch(msg) {
            res.status(400).send(msg)
        }
    }

    const withPath = categories => {
        
        // Verifica se uma categoria tem uma categoria pai 
        const getParent = (categories, parentId) => {
            let parent = categories.filter(parent => parent.id === parentId)
            return parent.lenth ? parent[0] : null
        }

        // Retorna um novo array com uma subcategoria para a categoria
        const categoriesWithPath = categories.map(category => {
            let path = category.name
            let parent = getParent(categories, category.parentId)

            while(parent) {
                path = `${parent.name} > ${path}`
                parent = getParent(categories, parent.parentId)
            }

            return { ...category, path }
        })

        // Ordena as categorias pelo caminho (Path)
        categoriesWithPath.sort((a, b) => {
            if(a.path < b.path) return -1
            if(a.path > b.path) return 1
            return 0
        })

        return categoriesWithPath    
    }
    
    const get = (req, res) => {
        app.db('categories')
            .then(categories => res.json(withPath(categories)))
            .catch(err => res.status(500).send(err))
    }

    const getById = (req, res) => {
        app.db('categories')
            .where({ id: req.params.id })
            .first()
            .then(category => res.json(category))
            .catch(err => res.status(500).send(err))
    }

    // Método para retornar os elementos filhos das categorias em uma estr. de árvore
    const toTree = (categories, tree) => {
        if(!tree) tree = categories.filter(c => !c.parentId)
        tree = tree.map(parentNode => {
            const isChild = node => node.parentId == parentNode.id
            parentNode.children = toTree(categories, categories.filter(isChild))
            return parentNode
        })
        return tree
    }

    const getTree = (req, res) => {
        app.db('categories')
            .then(categories => res.json(toTree(categories)))
            .catch(err => res.status(500).send(err))
    }

    return { save, remove, get, getById, getTree }
}