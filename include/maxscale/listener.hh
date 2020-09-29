/*
 * Copyright (c) 2018 MariaDB Corporation Ab
 *
 * Use of this software is governed by the Business Source License included
 * in the LICENSE.TXT file and at www.mariadb.com/bsl11.
 *
 * Change Date: 2024-09-25
 *
 * On the date above, in accordance with the Business Source License, use
 * of this software will be governed by version 2 or later of the General
 * Public License.
 */
#pragma once

#include <maxscale/ccdefs.hh>
#include <maxscale/authenticator.hh>
#include <maxscale/query_classifier.hh>
#include <maxscale/ssl.hh>

class SERVICE;
namespace maxscale
{
class ProtocolModule;

/**
 * Increment the number of authentication failures from the remote address. If the number
 * exceeds the configured limit, future attempts to connect from the remote are be rejected.
 *
 * @param remote The address where the connection originated
 */
void mark_auth_as_failed(const std::string& remote);

/**
 * Listener settings and other data that is shared with all sessions created by the listener.
 * Should be referred to with shared_ptr.
 *
 * The contents should not change once a session with the data has been created, as this could
 * create concurrency issues. If listener settings are changed, the listener should create a new
 * shared data object and share that with new sessions. The old sessions will keep using the
 * previous settings.
 */
class ListenerSessionData
{
public:
    using SProtocol = std::unique_ptr<mxs::ProtocolModule>;
    using SAuthenticator = std::unique_ptr<mxs::AuthenticatorModule>;

    struct ConnectionInitSql
    {
        ConnectionInitSql() = default;
        ConnectionInitSql(const ConnectionInitSql& rhs) = default;

        std::vector<std::string> queries;
        std::vector<uint8_t>     buffer_contents;
    };

    /**
     * Create listener data object for test purposes. The parameters should still be valid listener
     * settings, as they are parsed normally. Returns a shared_ptr as that is typically used by tests.
     *
     * @param params Associated listener settings
     * @return New listener data object for test sessions
     */
    static std::shared_ptr<mxs::ListenerSessionData> create_test_data(const mxs::ConfigParameters& params);

    ListenerSessionData(SSLContext ssl, qc_sql_mode_t default_sql_mode, SERVICE* service,
                        SProtocol protocol_module, const std::string& listener_name,
                        std::vector<SAuthenticator>&& authenticators, ConnectionInitSql&& init_sql);

    ListenerSessionData(const ListenerSessionData&) = delete;
    ListenerSessionData& operator=(const ListenerSessionData&) = delete;

    const SSLContext    m_ssl;                  /**< SSL settings */
    const qc_sql_mode_t m_default_sql_mode;     /**< Default sql mode for the listener */
    SERVICE&            m_service;              /**< The service the listener feeds */
    const SProtocol     m_proto_module;         /**< Protocol module */
    const std::string   m_listener_name;        /**< Name of the owning listener */

    /**
     * Authenticator modules used by the sessions created from the listener. The session will select
     * an authenticator module during authentication.
     */
    const std::vector<SAuthenticator> m_authenticators;

    /** Connection init sql queries. Only used by MariaDB-protocol module .*/
    const ConnectionInitSql m_conn_init_sql;
};
}
