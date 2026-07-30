package com.k12.platform.iam.mapper.memory;

import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.UserAccount;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryUserMapper implements UserMapper {

    private final AtomicLong idGenerator = new AtomicLong(2);
    private final Map<Long, UserAccount> users = new ConcurrentHashMap<>();

    public InMemoryUserMapper() {
        users.put(1L, new UserAccount(
                1L,
                "admin",
                "Administrator",
                "admin@example.com",
                "ROLE_ADMIN",
                "ENABLED",
                Instant.now()
        ));
    }

    @Override
    public List<UserAccount> findAll() {
        return new ArrayList<>(users.values());
    }

    @Override
    public Optional<UserAccount> findById(Long id) {
        return Optional.ofNullable(users.get(id));
    }

    @Override
    public UserAccount insert(UserAccount user) {
        Long id = idGenerator.getAndIncrement();
        UserAccount saved = new UserAccount(
                id,
                user.username(),
                user.nickname(),
                user.email(),
                user.roleCode(),
                user.status(),
                user.updatedTime()
        );
        users.put(id, saved);
        return saved;
    }

    @Override
    public UserAccount update(UserAccount user) {
        users.put(user.id(), user);
        return user;
    }

    @Override
    public boolean deleteById(Long id) {
        return users.remove(id) != null;
    }

    @Override
    public boolean existsById(Long id) {
        return users.containsKey(id);
    }
}
