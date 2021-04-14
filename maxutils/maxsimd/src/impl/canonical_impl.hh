/*
 * Copyright (c) 2021 MariaDB Corporation Ab
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

#pragma once

#include <string>

/** The concrete implementations of get_canonical */
namespace maxsimd::generic
{
std::string* get_canonical_impl(std::string* pSql);
}

namespace maxsimd::simd256
{
std::string* get_canonical_impl(std::string* pSql);
}
