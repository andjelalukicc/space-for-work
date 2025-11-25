package com.demo.bookstore_app.services;

import com.demo.bookstore_app.models.Book;
import com.demo.bookstore_app.repositories.BookRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BookService {

    @Autowired
    private BookRepository bookRepository;

    public Book getBookById(Long bookId) throws Exception {
        if (bookId == null || bookId < 0)
            throw new Exception("Invalid ID!");
        Book result = bookRepository.getById(bookId);
        if (result == null) throw new Exception("Cannot find book with this ID!");
        return result;
    }

    public List<Book> getAllBooks() throws Exception {
        List<Book> result = bookRepository.findAll();
        if (result == null || result.size() == 0) throw new Exception("Cannot find any book!");
        return result;
    }

    public Book saveBook(Book newBook) throws Exception {
        Book result = bookRepository.save(newBook);
        if (result == null) throw new Exception("Cannot save this book!");
        return result;
    }

    public Book updateBook(Long bookId, Book updatedBook) throws Exception {
        return bookRepository.findById(bookId).map(book -> {
            book.setBookGenre(updatedBook.getBookGenre());
            book.setBookName(updatedBook.getBookName());
            book.setBookPrice(updatedBook.getBookPrice());
            book.setAuthorName(updatedBook.getAuthorName());
            book.setPublishingYear(updatedBook.getPublishingYear());
            return bookRepository.save(book);
        }).orElseThrow(()->
         new Exception("Cannot save this book!"));
    }

    public void deleteBook(Long bookId) throws Exception {
        if (bookId == null || bookId < 0)
            throw new Exception("Invalid ID!");
        try {
            bookRepository.deleteById(bookId);
        } catch (Exception ex) {
            throw new Exception("Error while deleting book in database!");
        }
    }

    public List<Book> searchBooksByAuthor(String author){
        return bookRepository.findByAuthorNameContainingIgnoreCase(author);
    }

    public List<Book> searchBooksByTitle(String title){
        return bookRepository.findByBookNameContainingIgnoreCase(title);
    }

    public List<Book> searchBooksByGenre(String genre){
        return bookRepository.findByBookGenreContainingIgnoreCase(genre);
    }
}
