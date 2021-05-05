/*
 * Copyright (c) 2020 MariaDB Corporation Ab
 *
 * Use of this software is governed by the Business Source License included
 * in the LICENSE.TXT file and at www.mariadb.com/bsl11.
 *
 * Change Date: 2025-03-24
 *
 * On the date above, in accordance with the Business Source License, use
 * of this software will be governed by version 2 or later of the General
 * Public License.
 */
export default {
    namespaced: true,
    state: {
        rc_target_names_map: {},
        query_conn_id_map: JSON.parse(sessionStorage.getItem('query_conn_id_map')),
        curr_cnct_resource_name: sessionStorage.getItem('curr_cnct_resource_name'),
        loading_db_tree: false,
        db_tree: [],
        db_completion_list: [],
        loading_preview_data: false,
        preview_data: {},
        loading_data_details: false,
        data_details: {},
        loading_query_result: false,
        query_result: {},
        curr_query_mode: 'QUERY_VIEW',
    },
    mutations: {
        SET_RC_TARGET_NAMES_MAP(state, payload) {
            state.rc_target_names_map = payload
        },
        SET_CURR_CNCT_RESOURCE_NAME(state, payload) {
            state.curr_cnct_resource_name = payload
        },
        SET_QUERY_CNN_ID_MAP(state, payload) {
            state.query_conn_id_map = payload
        },
        SET_LOADING_DB_TREE(state, payload) {
            state.loading_db_tree = payload
        },
        SET_DB_TREE(state, payload) {
            state.db_tree = payload
        },
        UPDATE_DB_CMPL_LIST(state, payload) {
            state.db_completion_list = [...state.db_completion_list, ...payload]
        },
        CLEAR_DB_CMPL_LIST(state) {
            state.db_completion_list = []
        },
        SET_LOADING_PREVIEW_DATA(state, payload) {
            state.loading_preview_data = payload
        },
        SET_PREVIEW_DATA(state, payload) {
            state.preview_data = payload
        },

        SET_LOADING_DATA_DETAILS(state, payload) {
            state.loading_data_details = payload
        },
        SET_DATA_DETAILS(state, payload) {
            state.data_details = payload
        },

        SET_LOADING_QUERY_RESULT(state, payload) {
            state.loading_query_result = payload
        },
        SET_QUERY_RESULT(state, payload) {
            state.query_result = payload
        },

        SET_CURR_QUERY_MODE(state, payload) {
            state.curr_query_mode = payload
        },

        UPDATE_DB_CHILDREN(state, { dbIndex, children }) {
            state.db_tree = this.vue.$help.immutableUpdate(state.db_tree, {
                [dbIndex]: { children: { $set: children } },
            })
        },
        UPDATE_DB_GRAND_CHILDREN(state, { dbIndex, tableIndex, children }) {
            state.db_tree = this.vue.$help.immutableUpdate(state.db_tree, {
                [dbIndex]: { children: { [tableIndex]: { children: { $set: children } } } },
            })
        },
    },
    actions: {
        async fetchRcTargetNames({ state, commit }, resourceType) {
            try {
                let res = await this.vue.$axios.get(`/${resourceType}?fields[${resourceType}]=id`)
                if (res.data.data) {
                    const names = res.data.data.map(({ id, type }) => ({ id, type }))
                    commit('SET_RC_TARGET_NAMES_MAP', {
                        ...state.rc_target_names_map,
                        [resourceType]: names,
                    })
                }
            } catch (e) {
                const logger = this.vue.$logger('store-query-fetchRcTargetNames')
                logger.error(e)
            }
        },
        async openConnect({ state, dispatch, commit }, body) {
            try {
                let res = await this.vue.$axios.post(`/sql?persist=yes`, body)
                if (res.status === 201) {
                    commit(
                        'SET_SNACK_BAR_MESSAGE',
                        {
                            text: [`Connection successful`],
                            type: 'success',
                        },
                        { root: true }
                    )
                    const connId = res.data.data.id
                    const cnctResourceMap = {
                        ...state.query_conn_id_map,
                        [body.target]: connId,
                    }
                    sessionStorage.setItem('query_conn_id_map', JSON.stringify(cnctResourceMap))

                    sessionStorage.setItem('curr_cnct_resource_name', body.target)
                    commit('SET_CURR_CNCT_RESOURCE_NAME', body.target)
                    commit('SET_QUERY_CNN_ID_MAP', cnctResourceMap)
                    await dispatch('fetchDbList')
                }
            } catch (e) {
                commit(
                    'SET_SNACK_BAR_MESSAGE',
                    {
                        text: [`Connection failed`],
                        type: 'error',
                    },
                    { root: true }
                )
                const logger = this.vue.$logger('store-query-openConnect')
                logger.error(e)
            }
        },
        async disconnect({ state, commit }) {
            try {
                await this.vue.$axios.delete(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}`
                )
                sessionStorage.removeItem('query_conn_id_map')
                this.vue.$help.deleteCookie('conn_id_body')
                commit('SET_QUERY_CNN_ID_MAP', null)
            } catch (e) {
                /* TODO: Show error in snackbar */
                const logger = this.vue.$logger('store-query-disconnect')
                logger.error(e)
            }
        },
        async fetchDbList({ dispatch, state, commit }) {
            try {
                commit('SET_LOADING_DB_TREE', true)
                const res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: 'SHOW DATABASES',
                    }
                )
                await this.vue.$help.delay(400)
                let dbCmplList = []
                let dbTree = []
                res.data.data.attributes.results[0].data.flat().forEach(db => {
                    dbTree.push({
                        type: 'schema',
                        name: db,
                        id: db,
                        children: [],
                    })
                    dbCmplList.push({
                        label: db,
                        detail: 'SCHEMA',
                        insertText: db,
                        type: 'schema',
                    })
                })
                commit('SET_DB_TREE', dbTree)
                commit('CLEAR_DB_CMPL_LIST')
                commit('UPDATE_DB_CMPL_LIST', dbCmplList)
                commit('SET_LOADING_DB_TREE', false)
            } catch (e) {
                commit(
                    'SET_SNACK_BAR_MESSAGE',
                    {
                        text: [`Connection timed out`],
                        type: 'error',
                    },
                    { root: true }
                )
                dispatch('disconnect')
                const logger = this.vue.$logger('store-query-fetchDbList')
                logger.error(e)
            }
        },
        /**
         * @param {Object} db - Database object.
         */
        async fetchTables({ state, commit }, db) {
            try {
                //TODO: for testing purpose, replace it with config obj
                const query = `SHOW TABLES FROM ${db.id};`
                const res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: query,
                    }
                )
                await this.vue.$help.delay(400)
                const tables = res.data.data.attributes.results[0].data.flat()
                let dbChilren = []
                let dbCmplList = []
                tables.forEach(tbl => {
                    dbChilren.push({
                        type: 'table',
                        name: tbl,
                        id: `${db.id}.${tbl}`,
                        children: [],
                    })
                    dbCmplList.push({
                        label: tbl,
                        detail: 'TABLE',
                        insertText: tbl,
                        type: 'table',
                    })
                })
                commit('UPDATE_DB_CMPL_LIST', dbCmplList)
                commit('UPDATE_DB_CHILDREN', {
                    dbIndex: state.db_tree.indexOf(db),
                    children: dbChilren,
                })
            } catch (e) {
                /* TODO: Show error in snackbar */
                const logger = this.vue.$logger('store-query-fetchTables')
                logger.error(e)
            }
        },
        /**
         * @param {Object} tbl - Table object.
         */
        async fetchCols({ state, commit }, tbl) {
            try {
                const dbId = tbl.id.split('.')[0]
                // eslint-disable-next-line vue/max-len
                const query = `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_NAME = "${tbl.name}";`
                const res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: query,
                    }
                )
                if (res.data) {
                    await this.vue.$help.delay(400)
                    const cols = res.data.data.attributes.results[0].data
                    const dbIndex = state.db_tree.findIndex(db => db.id === dbId)

                    let tblChildren = []
                    let dbCmplList = []

                    cols.forEach(([colName, colType]) => {
                        tblChildren.push({
                            name: colName,
                            dataType: colType,
                            type: 'column',
                            id: `${tbl.id}.${colName}`,
                        })
                        dbCmplList.push({
                            label: colName,
                            insertText: colName,
                            detail: 'COLUMN',
                            type: 'column',
                        })
                    })

                    commit('UPDATE_DB_CMPL_LIST', dbCmplList)

                    commit(
                        'UPDATE_DB_GRAND_CHILDREN',
                        Object.freeze({
                            dbIndex,
                            tableIndex: state.db_tree[dbIndex].children.indexOf(tbl),
                            children: tblChildren,
                        })
                    )
                }
            } catch (e) {
                /* TODO: Show error in snackbar */
                const logger = this.vue.$logger('store-query-fetchCols')
                logger.error(e)
            }
        },

        //TODO: DRY fetchPreviewData and fetchDataDetails actions
        /**
         * @param {String} tblId - Table id (database_name.table_name).
         */
        async fetchPreviewData({ state, commit }, tblId) {
            try {
                commit('SET_LOADING_PREVIEW_DATA', true)
                let res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: `SELECT * FROM ${tblId};`,
                    }
                )
                await this.vue.$help.delay(400)
                commit('SET_PREVIEW_DATA', Object.freeze(res.data.data.attributes.results[0]))
                commit('SET_LOADING_PREVIEW_DATA', false)
            } catch (e) {
                const logger = this.vue.$logger('store-query-fetchPreviewData')
                logger.error(e)
            }
        },
        /**
         * @param {String} tblId - Table id (database_name.table_name).
         */
        async fetchDataDetails({ state, commit }, tblId) {
            try {
                commit('SET_LOADING_DATA_DETAILS', true)
                let res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: `DESCRIBE ${tblId};`,
                    }
                )
                await this.vue.$help.delay(400)
                commit('SET_DATA_DETAILS', Object.freeze(res.data.data.attributes.results[0]))
                commit('SET_LOADING_DATA_DETAILS', false)
            } catch (e) {
                const logger = this.vue.$logger('store-query-fetchDataDetails')
                logger.error(e)
            }
        },

        /**
         * @param {String} query - SQL query string
         */
        async fetchQueryResult({ state, commit }, query) {
            try {
                commit('SET_LOADING_QUERY_RESULT', true)
                let res = await this.vue.$axios.post(
                    `/sql/${state.query_conn_id_map[state.curr_cnct_resource_name]}/queries`,
                    {
                        sql: query,
                    }
                )
                await this.vue.$help.delay(400)
                commit('SET_QUERY_RESULT', Object.freeze(res.data.data.attributes.results[0]))
                commit('SET_LOADING_QUERY_RESULT', false)
            } catch (e) {
                const logger = this.vue.$logger('store-query-fetchQueryResult')
                logger.error(e)
            }
        },

        /**
         * This action clears preview_data and data_details to empty object.
         * Call this action when user selects option in the sidebar.
         * This ensure sub-tabs in Data Preview tab are generated with fresh data
         */
        clearDataPreview({ commit }) {
            commit('SET_PREVIEW_DATA', {})
            commit('SET_DATA_DETAILS', {})
        },
        /**
         * @param {String} mode - SQL query mode
         */
        setCurrQueryMode({ commit }, mode) {
            commit('SET_CURR_QUERY_MODE', mode)
        },
    },
}
