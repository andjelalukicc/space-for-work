package com.demo.bookstore_app.repositories;

import com.demo.bookstore_app.models.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {

    List<Book> findByBookNameContainingIgnoreCase(String title);
    List<Book> findByBookGenreContainingIgnoreCase(String genre);
    List<Book> findByAuthorNameContainingIgnoreCase(String author);
}
