/**
 * MXS-1677: Error messages logged for non-text queries after temporary table is created
 *
 * https://jira.mariadb.org/browse/MXS-1677
 */
#include <maxtest/testconnections.hh>

int main(int argc, char** argv)
{
    TestConnections test(argc, argv);

    test.maxscales->connect();
    test.try_query(test.maxscales->conn_rwsplit[0], "CREATE TEMPORARY TABLE test.temp(id INT)");
    test.maxscales->disconnect();

    test.log_excludes("The provided buffer does not contain a COM_QUERY, but a COM_QUIT");
    return test.global_result;
}
