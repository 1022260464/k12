package com.k12.platform.iam.mapper;

import com.k12.platform.iam.model.UserAccount;

import java.util.List;
import java.util.Optional;

public interface UserMapper {

    List<UserAccount> findAll();

    Optional<UserAccount> findById(Long id);

    UserAccount insert(UserAccount user);

    UserAccount update(UserAccount user);

    boolean deleteById(Long id);

    boolean existsById(Long id);
}
